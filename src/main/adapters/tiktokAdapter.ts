/**
 * v0.10.0：TikTok 影片發布（Content Posting API・Direct Post）
 *
 * 流程（developers.tiktok.com/docs/en/content-posting-api-reference-direct-post）：
 *  1. creator_info/query — 取得此帳號可用的 privacy_level 選項
 *  2. video/init（source=FILE_UPLOAD）— 取得 publish_id + upload_url
 *  3. PUT 分塊上傳（Content-Range），本機檔案直傳 TikTok，不需 tunnel / port
 *  4. status/fetch 輪詢直到 PUBLISH_COMPLETE / FAILED
 *
 * 限制（官方）：
 *  - 未過 TikTok 審核（audit）的 client：發布內容強制私人可見（SELF_ONLY），
 *    且 24 小時內最多 5 個使用者可發文 — 與 Meta 開發模式同概念，自用不受影響
 *  - access token 約 24h：每次發布前自動用 refresh token（365 天）換新
 */
import { open } from 'node:fs/promises';
import { statSync } from 'node:fs';
import axios, { AxiosError } from 'axios';
import {
  getAccountById,
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  upsertAccount
} from '../lib/accountsRepo';
import { loadCredentialsJson } from '../lib/credentialsStore';
import type { UploadProgressEvent } from './youtubeAdapter';

const API_BASE = 'https://open.tiktokapis.com/v2';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

/** 分塊規則：≤64MB 單塊；>64MB 以 10MB 分塊、尾塊吸收餘數 */
const SINGLE_CHUNK_MAX = 64 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
}

function assertOk<T>(resp: { data: TikTokEnvelope<T> }, context: string): T {
  const err = resp.data.error;
  if (err && err.code && err.code !== 'ok') {
    throw new Error(`TikTok ${context} 失敗：${err.code} ${err.message ?? ''}`.trim());
  }
  return (resp.data.data ?? {}) as T;
}

/** 發布前自動 refresh（access token 只有 24h） */
export async function ensureFreshTikTokToken(accountId: number): Promise<string> {
  const account = getAccountById(accountId);
  if (!account) throw new Error('TikTok 帳號不存在');
  const accessToken = getDecryptedAccessToken(accountId);
  if (!accessToken) throw new Error('TikTok access token 不存在，請重新連線');

  const stillValid =
    account.expiresAt !== null && account.expiresAt - Date.now() > 10 * 60 * 1000;
  if (stillValid) return accessToken;

  const refreshToken = getDecryptedRefreshToken(accountId);
  if (!refreshToken) {
    // 沒 refresh token 又過期 → 只能讓 API 自己報 401
    return accessToken;
  }

  const creds = loadCredentialsJson('tiktok') as { client_key: string; client_secret: string };
  const resp = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      client_key: creds.client_key,
      client_secret: creds.client_secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const tk = resp.data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tk.access_token) {
    throw new Error(
      `TikTok token 續期失敗：${tk.error ?? ''} ${tk.error_description ?? ''}（請到帳號頁重新連線）`.trim()
    );
  }

  upsertAccount({
    platform: 'tiktok',
    displayName: account.displayName,
    externalId: account.externalId,
    accessToken: tk.access_token,
    refreshToken: tk.refresh_token ?? refreshToken,
    expiresAt: tk.expires_in ? Date.now() + tk.expires_in * 1000 : null,
    metadata: {
      ...account.metadata,
      refreshExpiresAt: tk.refresh_expires_in
        ? Date.now() + tk.refresh_expires_in * 1000
        : (account.metadata.refreshExpiresAt ?? null)
    }
  });
  console.log('[tiktok] access token refreshed');
  return tk.access_token;
}

export interface TikTokUploadOptions {
  accountId: number;
  filePath: string;
  /** 影片標題（TikTok 無獨立 description；上限 2200 字） */
  title: string;
  privacy: 'public' | 'private';
}

export interface TikTokUploadResult {
  publishId: string;
  /** 貼文 ID（未過 audit 的 SELF_ONLY 貼文也會有） */
  postId: string | null;
  url: string;
}

export async function uploadToTikTok(
  options: TikTokUploadOptions,
  onProgress?: (e: UploadProgressEvent) => void
): Promise<TikTokUploadResult> {
  const accessToken = await ensureFreshTikTokToken(options.accountId);
  const account = getAccountById(options.accountId);
  const username = (account?.metadata?.username as string | undefined) ?? null;
  const totalBytes = statSync(options.filePath).size;

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // ===== 1. creator info：拿可用的 privacy_level =====
    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 2 });
    const creator = assertOk<{
      privacy_level_options?: string[];
      max_video_post_duration_sec?: number;
    }>(
      await axios.post(`${API_BASE}/post/publish/creator_info/query/`, {}, { headers: authHeaders }),
      'creator_info'
    );
    const options_ = creator.privacy_level_options ?? [];
    const wantPublic = options.privacy === 'public';
    const privacyLevel = wantPublic && options_.includes('PUBLIC_TO_EVERYONE')
      ? 'PUBLIC_TO_EVERYONE'
      : options_.includes('SELF_ONLY')
        ? 'SELF_ONLY'
        : (options_[0] ?? 'SELF_ONLY');
    if (wantPublic && privacyLevel !== 'PUBLIC_TO_EVERYONE') {
      console.log(
        `[tiktok] 此 app 尚未通過 TikTok 審核，貼文將以 ${privacyLevel}（僅自己可見）發布`
      );
    }

    // ===== 2. init（FILE_UPLOAD）=====
    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 5 });
    const singleChunk = totalBytes <= SINGLE_CHUNK_MAX;
    const chunkSize = singleChunk ? totalBytes : CHUNK_SIZE;
    const totalChunkCount = singleChunk ? 1 : Math.floor(totalBytes / chunkSize);

    const init = assertOk<{ publish_id?: string; upload_url?: string }>(
      await axios.post(
        `${API_BASE}/post/publish/video/init/`,
        {
          post_info: {
            title: options.title.slice(0, 2200),
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: totalBytes,
            chunk_size: chunkSize,
            total_chunk_count: totalChunkCount
          }
        },
        { headers: authHeaders }
      ),
      'video init'
    );
    if (!init.publish_id || !init.upload_url) {
      throw new Error('TikTok init 回應缺 publish_id / upload_url');
    }

    // ===== 3. PUT 分塊上傳 =====
    const fh = await open(options.filePath, 'r');
    try {
      let uploaded = 0;
      for (let i = 0; i < totalChunkCount; i++) {
        const start = i * chunkSize;
        const isLast = i === totalChunkCount - 1;
        const end = isLast ? totalBytes - 1 : start + chunkSize - 1;
        const len = end - start + 1;
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, start);

        await axios.put(init.upload_url, buf, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(len),
            'Content-Range': `bytes ${start}-${end}/${totalBytes}`
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 10 * 60 * 1000
        });

        uploaded += len;
        const percent = Math.min(90, 5 + Math.round((uploaded / totalBytes) * 80));
        onProgress?.({ bytesUploaded: uploaded, totalBytes, percent });
      }
    } finally {
      await fh.close();
    }

    // ===== 4. 輪詢發布狀態 =====
    let postId: string | null = null;
    const deadline = Date.now() + 5 * 60 * 1000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = assertOk<{
        status?: string;
        fail_reason?: string;
        publicaly_available_post_id?: Array<number | string>;
      }>(
        await axios.post(
          `${API_BASE}/post/publish/status/fetch/`,
          { publish_id: init.publish_id },
          { headers: authHeaders }
        ),
        'status fetch'
      );

      if (status.status === 'PUBLISH_COMPLETE') {
        postId = status.publicaly_available_post_id?.[0] != null
          ? String(status.publicaly_available_post_id[0])
          : null;
        break;
      }
      if (status.status === 'FAILED') {
        throw new Error(`TikTok 發布失敗：${status.fail_reason ?? '未知原因'}`);
      }
      if (Date.now() > deadline) {
        throw new Error(`TikTok 發布逾時（5 分鐘仍在 ${status.status ?? '處理中'}）`);
      }
      onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 95 });
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });
    const url = postId && username
      ? `https://www.tiktok.com/@${username}/video/${postId}`
      : username
        ? `https://www.tiktok.com/@${username}`
        : 'https://www.tiktok.com/';
    console.log(`[tiktok] published, publish_id=${init.publish_id} post_id=${postId ?? '(private)'}`);
    return { publishId: init.publish_id, postId, url };
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      throw new Error(`TikTok API 錯誤：${JSON.stringify(e.response.data).slice(0, 300)}`);
    }
    throw e;
  }
}
