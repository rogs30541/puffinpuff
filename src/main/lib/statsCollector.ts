/**
 * v0.4.2：觸及數據抓取
 *
 * 每個平台 API：
 * - YouTube: GET /videos?part=statistics&id={videoId} → viewCount/likeCount/commentCount
 * - Facebook: GET /{post-id}/insights?metric=post_impressions,post_engaged_users → reach
 *           + GET /{post-id}?fields=likes.summary(true),comments.summary(true),shares
 * - Instagram: GET /{media-id}/insights?metric=reach,likes,comments,saved,shares
 */

import axios, { AxiosError } from 'axios';
import { google } from 'googleapis';
import { getAccountById, getDecryptedAccessToken, getDecryptedRefreshToken } from './accountsRepo';
import { loadCredentialsJson } from './credentialsStore';

export interface PostStats {
  views: number | null;
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  reach: number | null;
  /** v0.9.14：FB 粉專層級互動資料（NPE + 開發模式下貼文層級讚數鎖死時的替代） */
  pageFans?: number | null;
  pageFollowers?: number | null;
}

interface GoogleCredentials {
  installed: { client_id: string; client_secret: string; };
}

interface MetaCredentials {
  api_version: string;
}

function loadGoogleCreds(): GoogleCredentials {
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('google') as GoogleCredentials;
}

function loadMetaCreds(): MetaCredentials {
  return loadCredentialsJson('meta') as MetaCredentials;
}

/** YouTube 數據（用 OAuth2 access token call YT Data API） */
export async function fetchYouTubeStats(accountId: number, videoId: string): Promise<PostStats> {
  const account = getAccountById(accountId);
  if (!account) throw new Error('YT 帳號不存在');
  const accessToken = getDecryptedAccessToken(accountId);
  const refreshToken = getDecryptedRefreshToken(accountId);
  if (!accessToken) throw new Error('YT access token 不存在');

  const creds = loadGoogleCreds();
  const oauth2Client = new google.auth.OAuth2(
    creds.installed.client_id,
    creds.installed.client_secret
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined
  });

  const yt = google.youtube({ version: 'v3', auth: oauth2Client });
  const resp = await yt.videos.list({
    part: ['statistics'],
    id: [videoId]
  });
  const item = resp.data.items?.[0];
  if (!item) throw new Error('YouTube 影片不存在或已下架');
  const s = item.statistics ?? {};
  return {
    views: s.viewCount ? parseInt(s.viewCount, 10) : null,
    likesCount: s.likeCount ? parseInt(s.likeCount, 10) : null,
    commentsCount: s.commentCount ? parseInt(s.commentCount, 10) : null,
    sharesCount: null, // YT 沒提供
    reach: null
  };
}

/** Facebook 數據（Reels post / 圖文 post）*/
export async function fetchFacebookStats(accountId: number, postId: string): Promise<PostStats> {
  const accessToken = getDecryptedAccessToken(accountId);
  if (!accessToken) throw new Error('FB token 不存在');
  const { api_version: apiVersion } = loadMetaCreds();

  // v0.9.14 實測結論（Graph API Explorer 逐欄位驗證）：
  //   新版粉絲專頁（NPE）＋ app 未過審（開發模式）時：
  //   - 貼文層級 likes.summary → (#10) 需 Advanced Access（過審後才通）
  //   - comments / reactions → (#10) 需 pages_read_user_content（本 app 未申請）
  //   - 粉專層級 fan_count / followers_count → pages_read_engagement 開發模式即可讀 ✅
  //   策略：貼文層級盡力而為（過審後自動恢復），#10 不視為錯誤；
  //         一律補抓粉專層級數據，兩者都失敗才丟錯。
  let likes: number | null = null;
  let comments: number | null = null;
  let shares: number | null = null;
  let postLevelError: string | null = null;

  try {
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/${postId}`, {
      params: {
        fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0),shares',
        access_token: accessToken
      }
    });
    likes = data.likes?.summary?.total_count ?? null;
    comments = data.comments?.summary?.total_count ?? null;
    shares = data.shares?.count ?? null;
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      const code = (e.response.data as { error?: { code?: number } })?.error?.code;
      if (code !== 10) {
        postLevelError = JSON.stringify(e.response.data).slice(0, 200);
      }
      // (#10)＝開發模式 NPE 限制，預期內，不當錯誤
    } else {
      throw e;
    }
  }

  // 粉專層級：fan_count / followers_count（pages_read_engagement 的開發模式可用範圍）
  let pageFans: number | null = null;
  let pageFollowers: number | null = null;
  const account = getAccountById(accountId);
  if (account?.externalId) {
    try {
      const { data: pageData } = await axios.get(
        `https://graph.facebook.com/${apiVersion}/${account.externalId}`,
        {
          params: {
            fields: 'fan_count,followers_count',
            access_token: accessToken
          }
        }
      );
      pageFans = pageData.fan_count ?? null;
      pageFollowers = pageData.followers_count ?? null;
    } catch (e) {
      if (postLevelError === null && likes === null && comments === null) {
        // 貼文層級與粉專層級都拿不到 → 回報粉專層級的錯誤
        if (e instanceof AxiosError && e.response) {
          throw new Error(
            `FB stats fetch failed: ${JSON.stringify(e.response.data).slice(0, 200)}`
          );
        }
        throw e;
      }
    }
  }

  if (postLevelError && pageFans === null && pageFollowers === null) {
    throw new Error(`FB stats fetch failed: ${postLevelError}`);
  }

  return {
    views: null,
    likesCount: likes,
    commentsCount: comments,
    sharesCount: shares,
    reach: null,
    pageFans,
    pageFollowers
  };
}

/** Instagram 數據 */
export async function fetchInstagramStats(accountId: number, mediaId: string): Promise<PostStats> {
  const accessToken = getDecryptedAccessToken(accountId);
  if (!accessToken) throw new Error('IG token 不存在');
  const { api_version: apiVersion } = loadMetaCreds();

  try {
    // 先拿 basic counts
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
      params: {
        fields: 'like_count,comments_count,media_type',
        access_token: accessToken
      }
    });
    const likes = data.like_count ?? null;
    const comments = data.comments_count ?? null;
    const mediaType = data.media_type as string | undefined;

    // 拿 insights（Business / Creator 帳號才有）
    // 影片：reach,plays  圖文：reach,saves,impressions
    let reach: number | null = null;
    let views: number | null = null;
    const metrics = mediaType === 'VIDEO' || mediaType === 'REELS'
      ? 'reach,plays'
      : 'reach,impressions';
    try {
      const { data: ins } = await axios.get(
        `https://graph.facebook.com/${apiVersion}/${mediaId}/insights`,
        {
          params: {
            metric: metrics,
            access_token: accessToken
          }
        }
      );
      const insArr = ins.data as Array<{ name: string; values: Array<{ value: number }> }>;
      for (const m of insArr) {
        if (m.name === 'reach') reach = m.values[0]?.value ?? null;
        if (m.name === 'plays') views = m.values[0]?.value ?? null;
        if (m.name === 'impressions' && views === null) views = m.values[0]?.value ?? null;
      }
    } catch {
      /* insights 失敗（非 Business / 權限不足）→ null */
    }

    return {
      views,
      likesCount: likes,
      commentsCount: comments,
      sharesCount: null,
      reach
    };
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      throw new Error(`IG stats fetch failed: ${JSON.stringify(e.response.data).slice(0, 200)}`);
    }
    throw e;
  }
}

/**
 * v0.9.12：舊紀錄 remote_id 回填 — 從貼文網址反推平台資源 ID。
 * v0.9.11 以前發布管線沒把平台 ID 存進 post_targets，抓數據會被跳過；
 * 這裡讓舊紀錄按「抓取數據」時能自動補上 ID。
 */
export async function backfillRemoteIdFromUrl(
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads' | 'tiktok',
  accountId: number,
  remoteUrl: string
): Promise<string | null> {
  if (platform === 'youtube') {
    const m = remoteUrl.match(/(?:shorts\/|watch\?v=)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  if (platform === 'facebook') {
    let m = remoteUrl.match(/facebook\.com\/reel\/(\d+)/);
    if (m) return m[1];
    m = remoteUrl.match(/facebook\.com\/(\d+)\/posts\/(\d+)/);
    if (m) return `${m[1]}_${m[2]}`;
    m = remoteUrl.match(/facebook\.com\/[^/]+\/videos\/(\d+)/);
    if (m) return m[1];
    return null;
  }
  if (platform === 'instagram') {
    // IG 網址只有 shortcode，Graph API 需要數字 media id → 用 /{ig-user-id}/media 比對 permalink
    const sc = remoteUrl.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    if (!sc) return null;
    const shortcode = sc[1];
    const account = getAccountById(accountId);
    const accessToken = getDecryptedAccessToken(accountId);
    if (!account || !accessToken) return null;
    const { api_version: apiVersion } = loadMetaCreds();
    try {
      let url: string | null =
        `https://graph.facebook.com/${apiVersion}/${account.externalId}/media`;
      let params: Record<string, string> | undefined = {
        fields: 'id,permalink',
        limit: '100',
        access_token: accessToken
      };
      for (let page = 0; page < 3 && url; page++) {
        const resp = await axios.get(url, params ? { params } : undefined);
        const data = resp.data as {
          data?: Array<{ id: string; permalink?: string }>;
          paging?: { next?: string };
        };
        const items = data.data ?? [];
        const hit = items.find((it) => it.permalink?.includes(`/${shortcode}`));
        if (hit) return hit.id;
        url = data.paging?.next ?? null;
        params = undefined; // paging.next 已帶完整 query
      }
    } catch {
      /* 比對不到 → null */
    }
    return null;
  }
  return null;
}

/**
 * 通用：依平台分流取數據
 */
export async function fetchStatsForTarget(
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads' | 'tiktok',
  accountId: number,
  remoteId: string
): Promise<PostStats> {
  if (platform === 'youtube') return fetchYouTubeStats(accountId, remoteId);
  if (platform === 'facebook') return fetchFacebookStats(accountId, remoteId);
  if (platform === 'instagram') return fetchInstagramStats(accountId, remoteId);
  if (platform === 'threads') {
    // v0.7.0：Threads insights 需 threads_manage_insights 權限 — 先回空值不擋發布
    return { views: null, likesCount: null, commentsCount: null, sharesCount: null, reach: null };
  }
  if (platform === 'tiktok') {
    // v0.10.0：TikTok 影片數據需 video.list scope — 先回空值不擋發布
    return { views: null, likesCount: null, commentsCount: null, sharesCount: null, reach: null };
  }
  throw new Error(`不支援的平台：${platform}`);
}
