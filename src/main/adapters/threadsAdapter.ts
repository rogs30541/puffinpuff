/**
 * v0.7.0：Threads 上傳
 *
 * Threads API container 流程（跟 IG Reels 幾乎相同，但 endpoint 在 graph.threads.net）：
 *  1. POST /{user-id}/threads + media_type + text [+ image_url/video_url] → container_id
 *  2. GET /{container-id}?fields=status → 輪詢直到 FINISHED
 *  3. POST /{user-id}/threads_publish?creation_id=... → 發布
 *
 * media_type:
 *  - TEXT：純文字（text）
 *  - IMAGE：image_url + text
 *  - VIDEO：video_url + text
 *  - CAROUSEL：children=<container_id1,...> + text
 */
import { app } from 'electron';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import axios, { AxiosError } from 'axios';
import { getAccountById, getDecryptedAccessToken } from '../lib/accountsRepo';
import { serveFileViaCloudflareTunnel } from '../lib/tunnel';
import { parseMetaError } from '../lib/metaErrorHelpers';
import type { UploadProgressEvent } from './youtubeAdapter';

interface ThreadsCredentials {
  api_version: string;
}

function loadCredentials(): ThreadsCredentials {
  const path = join(app.getAppPath(), 'secrets', 'threads_oauth.json');
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ThreadsCredentials;
}

export interface ThreadsUploadArgs {
  accountId: number;
  /** 文字內容（最多 500 字，超過會被自動截短）*/
  text: string;
  /** 影片路徑 — 若有則走 VIDEO mode、否則純 TEXT */
  videoPath?: string;
  /** 圖片路徑 — 若有則走 IMAGE mode（與 videoPath 互斥） */
  imagePath?: string;
}

export interface ThreadsUploadResult {
  mediaId: string;
  url: string;
}

/** Threads 文字 500 字硬上限，超過自動截短 + 「...」*/
function truncateText(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function threadsError(phase: string, e: unknown): Error {
  if (e instanceof AxiosError && e.response) {
    console.error(`[threads] === API FAILURE @ phase=${phase} ===`);
    console.error(`[threads] HTTP status: ${e.response.status}`);
    console.error(`[threads] Request URL: ${e.config?.url}`);
    console.error(`[threads] Request method: ${e.config?.method}`);
    console.error(`[threads] Request params:`, e.config?.params);
    console.error(`[threads] Response data (full):`, JSON.stringify(e.response.data, null, 2));
    console.error(`[threads] === END FAILURE ===`);
  } else {
    console.error(`[threads] phase=${phase} unexpected error:`, e);
  }
  const parsed = parseMetaError(e);
  const err = new Error(`Threads ${phase}：${parsed.friendlyMessage}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).meta = parsed;
  return err;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 主上傳函式：依據有無 video / image 走不同 media_type。
 */
export async function uploadToThreads(
  args: ThreadsUploadArgs,
  onProgress?: (e: UploadProgressEvent) => void,
  onStatus?: (msg: string) => void
): Promise<ThreadsUploadResult> {
  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 Threads 帳號 id=${args.accountId}`);
  const userId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('Threads token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const baseUrl = `https://graph.threads.net/${apiVersion}`;
  const text = truncateText(args.text);

  // 決定 media_type + 媒體 URL
  let mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT';
  let tunnel: { url: string; close: () => Promise<void> } | null = null;
  let totalBytes = 0;

  if (args.videoPath) {
    mediaType = 'VIDEO';
    totalBytes = statSync(args.videoPath).size;
  } else if (args.imagePath) {
    mediaType = 'IMAGE';
    totalBytes = statSync(args.imagePath).size;
  }

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 5 });
  console.log(`[threads] uploading mediaType=${mediaType} to user_id=${userId}`);

  try {
    // Phase 1: 起 tunnel（如果有媒體）
    if (mediaType !== 'TEXT') {
      const filePath = args.videoPath ?? args.imagePath!;
      const ext = filePath.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? (mediaType === 'VIDEO' ? 'mp4' : 'jpg');
      tunnel = await serveFileViaCloudflareTunnel({
        filePath,
        exposedName: `media.${ext}`,
        onStatus
      });
      onProgress?.({ bytesUploaded: 0, totalBytes, percent: 15 });
      onStatus?.('等 Cloudflare edge propagate（3 秒）...');
      await sleep(3_000);
    }

    // Phase 2: 建 container
    const createUrl = `${baseUrl}/${userId}/threads`;
    let creationId: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: Record<string, any> = {
        media_type: mediaType,
        text,
        access_token: accessToken
      };
      if (mediaType === 'VIDEO' && tunnel) params.video_url = tunnel.url;
      if (mediaType === 'IMAGE' && tunnel) params.image_url = tunnel.url;

      const resp = await axios.post(createUrl, null, { params });
      console.log(`[threads] === CONTAINER CREATE RESPONSE ===`);
      console.log(`[threads] HTTP status: ${resp.status}`);
      console.log(`[threads] Full response.data:`, JSON.stringify(resp.data, null, 2));
      console.log(`[threads] === END CREATE RESPONSE ===`);
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
      creationId = data.id;
      console.log(`[threads] container created, creation_id=${creationId}`);
    } catch (e) {
      throw threadsError('create-container', e);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 25 });

    // Phase 3: 輪詢狀態（TEXT 通常立即 FINISHED，VIDEO/IMAGE 需要處理時間）
    const statusUrl = `${baseUrl}/${creationId}`;
    let attempts = 0;
    const maxAttempts = mediaType === 'TEXT' ? 12 : 60; // 純文字 60s 上限、有媒體 5 分鐘
    let finished = false;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const resp = await axios.get(statusUrl, {
          params: { fields: 'status', access_token: accessToken }
        });
        const data = resp.data as { status?: string };
        const code = data.status ?? 'UNKNOWN';
        console.log(`[threads] poll #${attempts}: status=${code}`);
        const pct = Math.min(90, 25 + (attempts / maxAttempts) * 65);
        onProgress?.({ bytesUploaded: 0, totalBytes, percent: pct });

        if (code === 'FINISHED') {
          finished = true;
          break;
        }
        if (code === 'ERROR' || code === 'EXPIRED') {
          throw new Error(`Container 處理失敗：${code}`);
        }
      } catch (e) {
        if (attempts > 3 && e instanceof AxiosError) {
          console.error(`[threads] poll #${attempts} fatal AxiosError:`,
            JSON.stringify(e.response?.data ?? null, null, 2));
          throw threadsError('poll-status', e);
        }
        console.warn(`[threads] poll #${attempts} transient error:`, (e as Error).message);
      }
      await sleep(5_000);
    }

    if (!finished) {
      throw new Error(`Container 超過 ${maxAttempts * 5}s 仍未完成處理`);
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 92 });

    // Phase 4: 發布
    const publishUrl = `${baseUrl}/${userId}/threads_publish`;
    let mediaId: string;
    try {
      const resp = await axios.post(publishUrl, null, {
        params: {
          creation_id: creationId,
          access_token: accessToken
        }
      });
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
      mediaId = data.id;
      console.log(`[threads] published, media_id=${mediaId}`);
    } catch (e) {
      throw threadsError('publish', e);
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });

    // 取得 permalink
    let permalink = `https://www.threads.net/@${account.metadata?.username ?? account.displayName}/post/${mediaId}`;
    try {
      const resp = await axios.get(`${baseUrl}/${mediaId}`, {
        params: { fields: 'permalink', access_token: accessToken }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = resp.data as any;
      if (data?.permalink) permalink = data.permalink;
    } catch {
      // permalink 拿不到也沒關係
    }

    return { mediaId, url: permalink };
  } finally {
    if (tunnel) {
      await tunnel.close().catch((e) => {
        console.error('[threads] tunnel close failed:', e);
      });
    }
  }
}
