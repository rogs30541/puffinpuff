import { readFileSync, statSync } from 'node:fs';
import axios, { AxiosError } from 'axios';
import {
  getAccountById,
  getDecryptedAccessToken
} from '../lib/accountsRepo';
import { parseMetaError } from '../lib/metaErrorHelpers';
import { loadCredentialsJson } from '../lib/credentialsStore';
import type { UploadProgressEvent } from './youtubeAdapter';

interface MetaCredentials {
  api_version: string;
}

function loadCredentials(): MetaCredentials {
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('meta') as MetaCredentials;
}

export interface FacebookUploadArgs {
  accountId: number; // FB Page account
  filePath: string;
  description: string;
  hashtags: string;
}

export interface FacebookUploadResult {
  videoId: string;
  url: string; // FB Reels 連結
}

function buildCaption(description: string, hashtags: string): string {
  const parts: string[] = [];
  if (description.trim()) parts.push(description.trim());
  if (hashtags.trim()) parts.push(hashtags.trim());
  return parts.join('\n\n');
}

/** 把 FB API 錯誤包裝成可讀訊息（v0.4.4 用 parseMetaError 給友善訊息）*/
function fbError(phase: string, e: unknown): Error {
  if (e instanceof AxiosError && e.response) {
    console.error(`[facebook] phase=${phase} failed (HTTP ${e.response.status}):`, e.response.data);
  } else {
    console.error(`[facebook] phase=${phase} unexpected error:`, e);
  }
  const parsed = parseMetaError(e);
  const err = new Error(`FB ${phase}：${parsed.friendlyMessage}`);
  // 把 metadata 掛上 .meta 給上層判斷
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).meta = parsed;
  return err;
}

/**
 * Facebook Reels API 3-step 上傳
 */
export async function uploadToFacebookReels(
  args: FacebookUploadArgs,
  onProgress?: (e: UploadProgressEvent) => void
): Promise<FacebookUploadResult> {
  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 FB 粉專帳號 id=${args.accountId}`);
  const pageId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('粉專 token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const stat = statSync(args.filePath);
  const totalBytes = stat.size;
  const caption = buildCaption(args.description, args.hashtags);

  console.log(
    `[facebook] uploading ${args.filePath} (${totalBytes} bytes) to page ${pageId} via ${apiVersion}`
  );

  // ---- Phase 1: start ----
  const apiBase = `https://graph.facebook.com/${apiVersion}/${pageId}/video_reels`;
  let startData: { video_id: string; upload_url: string };
  try {
    const startResp = await axios.post(apiBase, null, {
      params: { upload_phase: 'start', access_token: accessToken }
    });
    startData = startResp.data;
    if (!startData.video_id || !startData.upload_url) {
      throw new Error(`回應缺 video_id/upload_url：${JSON.stringify(startResp.data)}`);
    }
    console.log(`[facebook] phase=start ok, video_id=${startData.video_id}`);
  } catch (e) {
    throw fbError('start', e);
  }

  // ---- Phase 2: binary upload ----
  // FB rupload 要求 Content-Length + X-Entity-Length 兩個 header（或 Transfer-Encoding 單獨）。
  // 用 stream 時 axios 不會自動算 Content-Length；改成 Buffer 一次讀入，
  // 讓 axios 自動設 Content-Length，並手動補 X-Entity-Length。
  // TODO（V1.5）：超大檔（>500MB）改用 rupload chunked protocol 分段上傳避免吃 RAM
  try {
    const fileBuffer = readFileSync(args.filePath);
    const uploadResp = await axios.post(startData.upload_url, fileBuffer, {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: '0',
        file_size: String(totalBytes),
        'X-Entity-Length': String(totalBytes),
        'Content-Length': String(totalBytes),
        'Content-Type': 'application/octet-stream'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (evt) => {
        const bytesUploaded = evt.loaded;
        const total = evt.total ?? totalBytes;
        const percent = total > 0 ? Math.min(99, (bytesUploaded / total) * 100) : 0;
        onProgress?.({ bytesUploaded, totalBytes: total, percent });
      }
    });
    const uploadData = uploadResp.data as { success?: boolean };
    if (uploadData.success !== true) {
      throw new Error(`回應 success !== true：${JSON.stringify(uploadResp.data)}`);
    }
    console.log('[facebook] phase=upload ok');
  } catch (e) {
    throw fbError('upload', e);
  }

  // ---- Phase 3: finish + publish ----
  try {
    const finishResp = await axios.post(apiBase, null, {
      params: {
        upload_phase: 'finish',
        video_id: startData.video_id,
        video_state: 'PUBLISHED',
        description: caption.slice(0, 63000),
        access_token: accessToken
      }
    });
    const finishData = finishResp.data as { success?: boolean };
    if (finishData.success !== true) {
      throw new Error(`回應 success !== true：${JSON.stringify(finishResp.data)}`);
    }
    console.log('[facebook] phase=finish ok');
  } catch (e) {
    throw fbError('finish', e);
  }

  onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });

  return {
    videoId: startData.video_id,
    url: `https://www.facebook.com/reel/${startData.video_id}`
  };
}

// ============================================================
// v0.3.0：圖文貼文（單張圖 + 文字）發到 FB 粉專
// 走 POST /{page-id}/photos endpoint（multipart/form-data 上傳 source）
// ============================================================

export interface FacebookPhotoPostArgs {
  accountId: number; // FB Page account
  imagePath: string;
  caption: string;
  hashtags: string;
}

export interface FacebookPhotoPostResult {
  postId: string; // post_id（如 12345_67890）
  photoId: string;
  url: string;
}

/**
 * 發布圖文到 FB 粉專。
 * 用 multipart upload：附 source（image file）+ message（caption + hashtags）+ published=true
 */
export async function publishPhotoPost(
  args: FacebookPhotoPostArgs,
  onProgress?: (e: UploadProgressEvent) => void
): Promise<FacebookPhotoPostResult> {
  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 FB 粉專帳號 id=${args.accountId}`);
  const pageId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('粉專 token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const totalBytes = statSync(args.imagePath).size;
  const message = buildCaption(args.caption, args.hashtags);

  console.log(`[facebook] photo post ${args.imagePath} (${totalBytes} bytes) to page ${pageId}`);

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 5 });

  try {
    // 用 Node 18+ 原生 FormData + Blob 上傳（不需要 form-data 套件）
    const imageBuffer = readFileSync(args.imagePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([imageBuffer as any]);
    const form = new FormData();
    form.append('source', blob, args.imagePath.split(/[\\/]/).pop() ?? 'image.jpg');
    form.append('message', message.slice(0, 63000));
    form.append('published', 'true');
    form.append('access_token', accessToken);

    const url = `https://graph.facebook.com/${apiVersion}/${pageId}/photos`;
    const resp = await axios.post(url, form, {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (evt) => {
        const bytesUploaded = evt.loaded;
        const total = evt.total ?? totalBytes;
        const percent = total > 0 ? Math.min(99, (bytesUploaded / total) * 100) : 0;
        onProgress?.({ bytesUploaded, totalBytes: total, percent });
      }
    });

    const data = resp.data as { id?: string; post_id?: string };
    if (!data.id) {
      throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
    }
    const photoId = data.id;
    // post_id 格式：「{page_id}_{post_id}」，直接拼或用回傳值
    const postId = data.post_id ?? `${pageId}_${photoId}`;
    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });
    console.log(`[facebook] photo posted, photo_id=${photoId} post_id=${postId}`);

    return {
      postId,
      photoId,
      // FB 貼文連結：拼 https://www.facebook.com/{postId.replace('_','/posts/')}
      url: `https://www.facebook.com/${postId.replace('_', '/posts/')}`
    };
  } catch (e) {
    throw fbError('photo-post', e);
  }
}
