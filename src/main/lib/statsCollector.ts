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

  // postId 格式：可能是 「pageId_postId」 或 「video_id」 對 Reels
  // 簡化：先嘗試 /{postId}?fields=...，失敗則 try insights
  try {
    const { data } = await axios.get(`https://graph.facebook.com/${apiVersion}/${postId}`, {
      params: {
        fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.summary(true).limit(0)',
        access_token: accessToken
      }
    });
    const likes = data.likes?.summary?.total_count ?? data.reactions?.summary?.total_count ?? null;
    const comments = data.comments?.summary?.total_count ?? null;
    const shares = data.shares?.count ?? null;

    // 嘗試 insights 拿 reach（reach 是 Reels 才有，普通貼文是 post_impressions）
    let reach: number | null = null;
    try {
      const { data: ins } = await axios.get(
        `https://graph.facebook.com/${apiVersion}/${postId}/insights`,
        {
          params: {
            metric: 'post_impressions',
            access_token: accessToken
          }
        }
      );
      const m = ins.data?.[0]?.values?.[0]?.value;
      if (typeof m === 'number') reach = m;
    } catch {
      /* 沒有 insights 權限 → null */
    }

    return {
      views: null,
      likesCount: likes,
      commentsCount: comments,
      sharesCount: shares,
      reach
    };
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      throw new Error(`FB stats fetch failed: ${JSON.stringify(e.response.data).slice(0, 200)}`);
    }
    throw e;
  }
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
 * 通用：依平台分流取數據
 */
export async function fetchStatsForTarget(
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads',
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
  throw new Error(`不支援的平台：${platform}`);
}
