import { app } from 'electron';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import axios, { AxiosError } from 'axios';
import { getAccountById, getDecryptedAccessToken } from '../lib/accountsRepo';
import { serveFileViaCloudflareTunnel } from '../lib/tunnel';
import { parseMetaError } from '../lib/metaErrorHelpers';
import type { UploadProgressEvent } from './youtubeAdapter';

interface MetaCredentials {
  api_version: string;
}

function loadCredentials(): MetaCredentials {
  const path = join(app.getAppPath(), 'secrets', 'meta_oauth.json');
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as MetaCredentials;
}

export interface InstagramUploadArgs {
  accountId: number; // IG Business 帳號
  filePath: string;
  caption: string;
  hashtags: string;
}

export interface InstagramUploadResult {
  mediaId: string;
  url: string;
}

function buildCaption(caption: string, hashtags: string): string {
  const parts: string[] = [];
  if (caption.trim()) parts.push(caption.trim());
  if (hashtags.trim()) parts.push(hashtags.trim());
  return parts.join('\n\n');
}

/** 將 IG API 錯誤轉成易讀訊息（v0.4.4 用 parseMetaError 給友善訊息）
 *  v0.6.6：暴力 logging — 把 Meta 完整 response.data 印出來，方便 debug */
function igError(phase: string, e: unknown): Error {
  if (e instanceof AxiosError && e.response) {
    console.error(`[instagram] === IG API FAILURE @ phase=${phase} ===`);
    console.error(`[instagram] HTTP status: ${e.response.status}`);
    console.error(`[instagram] HTTP statusText: ${e.response.statusText}`);
    console.error(`[instagram] Request URL: ${e.config?.url}`);
    console.error(`[instagram] Request method: ${e.config?.method}`);
    console.error(`[instagram] Request params:`, e.config?.params);
    console.error(`[instagram] Response data (full):`, JSON.stringify(e.response.data, null, 2));
    console.error(`[instagram] Response headers:`, e.response.headers);
    console.error(`[instagram] === END FAILURE ===`);
  } else {
    console.error(`[instagram] phase=${phase} unexpected error:`, e);
  }
  const parsed = parseMetaError(e);
  const err = new Error(`IG ${phase}：${parsed.friendlyMessage}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).meta = parsed;
  return err;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Instagram Reels 上傳流程
 *
 * 1. 用 cloudflared tunnel 把本機影片暴露成公開 HTTPS URL
 * 2. POST /{ig_user_id}/media?media_type=REELS&video_url=... → 取得 creation_id
 * 3. 輪詢 GET /{creation_id}?fields=status_code 直到 FINISHED（最多 5 分鐘）
 * 4. POST /{ig_user_id}/media_publish?creation_id=... → 發布
 * 5. 關閉 tunnel
 */
export async function uploadToInstagramReels(
  args: InstagramUploadArgs,
  onProgress?: (e: UploadProgressEvent) => void,
  onStatus?: (msg: string) => void
): Promise<InstagramUploadResult> {
  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 IG 帳號 id=${args.accountId}`);
  const igUserId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('IG token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const totalBytes = statSync(args.filePath).size;
  const caption = buildCaption(args.caption, args.hashtags);

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 5 });

  console.log(`[instagram] uploading ${args.filePath} to ig_user_id ${igUserId}`);

  // ---- Phase 1: 建立 cloudflared tunnel ----
  const tunnel = await serveFileViaCloudflareTunnel({
    filePath: args.filePath,
    exposedName: 'video.mp4',
    onStatus
  });

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 15 });

  try {
    // v0.6.0：tunnel ready 後等 3 秒讓 Cloudflare edge 完成 propagation
    //         否則 Meta 立刻 fetch 可能 502
    onStatus?.('等 Cloudflare edge 路由 propagate（3 秒）...');
    await sleep(3_000);

    // ---- Phase 2: 建立 media container ----
    // v0.6.8：拿掉 share_to_feed（v0.6.0 加的，可能造成 dev mode 下的詭異狀態）
    //        Meta default share_to_feed=true 自動處理，不需我們顯式設
    const mediaUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media`;
    let creationId: string;
    try {
      const resp = await axios.post(mediaUrl, null, {
        params: {
          media_type: 'REELS',
          video_url: tunnel.url,
          caption: caption.slice(0, 2200),
          access_token: accessToken
        }
      });
      // v0.6.8：完整 log container 創建 response（不只 id），看 Meta 是否回額外訊息
      console.log(`[instagram] === CONTAINER CREATE RESPONSE ===`);
      console.log(`[instagram] HTTP status: ${resp.status}`);
      console.log(`[instagram] Full response.data:`, JSON.stringify(resp.data, null, 2));
      console.log(`[instagram] === END CREATE RESPONSE ===`);
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
      creationId = data.id;
      console.log(`[instagram] container created, creation_id=${creationId}`);
    } catch (e) {
      throw igError('create-container', e);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 25 });

    // ---- Phase 3: 輪詢 container 狀態 ----
    // status_code: IN_PROGRESS, FINISHED, ERROR, EXPIRED, PUBLISHED
    const statusUrl = `https://graph.facebook.com/${apiVersion}/${creationId}`;
    let attempts = 0;
    const maxAttempts = 60; // 60 * 5s = 5 分鐘上限
    let finished = false;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        // v0.6.9：只查 status_code，不查 status —— 推測 v0.3.x 加 status 字段把 IG 弄壞
        const resp = await axios.get(statusUrl, {
          params: { fields: 'status_code', access_token: accessToken }
        });
        const data = resp.data as { status_code?: string };
        const code = data.status_code ?? 'UNKNOWN';
        console.log(`[instagram] poll #${attempts}: status_code=${code}`);
        // 進度估算：輪詢階段佔 25-90%
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
          // v0.6.6：把 axios response 的 data 寫進額外 log，方便 trace
          console.error(`[instagram] poll #${attempts} fatal AxiosError, full response.data:`,
            JSON.stringify(e.response?.data ?? null, null, 2));
          throw igError('poll-status', e);
        }
        console.warn(`[instagram] poll #${attempts} transient error:`, (e as Error).message);
      }
      await sleep(5_000);
    }

    if (!finished) {
      throw new Error(`Container 超過 ${maxAttempts * 5}s 仍未完成處理（最後 status: 不明）`);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 92 });

    // ---- Phase 4: 發布 ----
    const publishUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media_publish`;
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
      console.log(`[instagram] published, media_id=${mediaId}`);
    } catch (e) {
      throw igError('publish', e);
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });

    // 取得 permalink
    let permalink = `https://www.instagram.com/reel/${mediaId}`;
    try {
      const resp = await axios.get(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
        params: { fields: 'permalink', access_token: accessToken }
      });
      if (resp.data?.permalink) permalink = resp.data.permalink;
    } catch {
      // permalink 拿不到也沒關係，用 fallback
    }

    return { mediaId, url: permalink };
  } finally {
    // 不論成功失敗都要關閉 tunnel
    await tunnel.close().catch((e) => {
      console.error('[instagram] tunnel close failed:', e);
    });
  }
}

// ============================================================
// v0.3.0：圖文貼文（單張圖）發到 IG Feed
// 流程：cloudflared tunnel → /media (image_url) → 輪詢 → /media_publish
// 跟 Reels 不同：media_type=IMAGE（不是 REELS），URL 給 image_url（不是 video_url）
// ============================================================

export interface InstagramImagePostArgs {
  accountId: number;
  imagePath: string;
  caption: string;
  hashtags: string;
}

export interface InstagramImagePostResult {
  mediaId: string;
  url: string;
}

export async function publishImagePost(
  args: InstagramImagePostArgs,
  onProgress?: (e: UploadProgressEvent) => void,
  onStatus?: (msg: string) => void
): Promise<InstagramImagePostResult> {
  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 IG 帳號 id=${args.accountId}`);
  const igUserId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('IG token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const totalBytes = statSync(args.imagePath).size;
  const caption = buildCaption(args.caption, args.hashtags);

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 5 });
  console.log(`[instagram] photo post ${args.imagePath} to ig_user_id ${igUserId}`);

  // 取得圖檔副檔名作為 exposedName
  const ext = args.imagePath.match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[0] ?? '.jpg';
  const exposedName = `image${ext.toLowerCase()}`;

  const tunnel = await serveFileViaCloudflareTunnel({
    filePath: args.imagePath,
    exposedName,
    onStatus
  });

  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 15 });

  try {
    // v0.6.0：tunnel propagation delay
    onStatus?.('等 Cloudflare edge propagate...');
    await sleep(3_000);

    // Phase 1: create container（IMAGE 模式，給 image_url）
    const mediaUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media`;
    let creationId: string;
    try {
      const resp = await axios.post(mediaUrl, null, {
        params: {
          // 注意：IG IMAGE post 不傳 media_type=IMAGE 也 OK（預設就是 IMAGE）
          // 但保留以明確語意
          image_url: tunnel.url,
          caption: caption.slice(0, 2200),
          access_token: accessToken
        }
      });
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
      creationId = data.id;
      console.log(`[instagram] image container created, creation_id=${creationId}`);
    } catch (e) {
      throw igError('create-image-container', e);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 40 });

    // Phase 2: 輪詢狀態（IG 通常處理單張圖很快，但仍輪詢以避免太早 publish）
    const statusUrl = `https://graph.facebook.com/${apiVersion}/${creationId}`;
    let attempts = 0;
    const maxAttempts = 24; // 24 * 2.5s = 60s 上限（圖片比影片快很多）
    let finished = false;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const resp = await axios.get(statusUrl, {
          params: { fields: 'status_code', access_token: accessToken }
        });
        const data = resp.data as { status_code?: string; status?: string };
        const code = data.status_code ?? 'UNKNOWN';
        console.log(`[instagram-image] poll #${attempts}: status_code=${code}`);
        const pct = Math.min(85, 40 + (attempts / maxAttempts) * 45);
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
          throw igError('poll-image-status', e);
        }
        console.warn(`[instagram-image] poll #${attempts} transient error:`, (e as Error).message);
      }
      await sleep(2_500);
    }

    if (!finished) {
      throw new Error(`Container 超過 ${maxAttempts * 2.5}s 仍未完成處理`);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 90 });

    // Phase 3: publish
    const publishUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media_publish`;
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
      console.log(`[instagram] image published, media_id=${mediaId}`);
    } catch (e) {
      throw igError('publish-image', e);
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });

    // permalink
    let permalink = `https://www.instagram.com/p/${mediaId}`;
    try {
      const resp = await axios.get(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
        params: { fields: 'permalink', access_token: accessToken }
      });
      if (resp.data?.permalink) permalink = resp.data.permalink;
    } catch {
      /* fallback */
    }

    return { mediaId, url: permalink };
  } finally {
    await tunnel.close().catch((e) => {
      console.error('[instagram-image] tunnel close failed:', e);
    });
  }
}

// ============================================================
// v0.3.2：IG Carousel（多圖貼文，2-10 張）
//
// 流程：
//   For each image i in 1..N:
//     1. 起 tunnel_i 暴露 image_i
//     2. POST /{ig-user-id}/media?image_url=...&is_carousel_item=true → child_i
//   3. POST /{ig-user-id}/media?media_type=CAROUSEL&children=child_1,...,child_N&caption=...
//      → parent creation_id
//   4. 輪詢 parent status
//   5. POST /{ig-user-id}/media_publish?creation_id=parent_id
//   6. 關閉所有 tunnels
// ============================================================

export type InstagramCarouselPostResult = InstagramImagePostResult;

export interface InstagramCarouselPostArgs {
  accountId: number;
  imagePaths: string[]; // 2-10 張
  caption: string;
  hashtags: string;
}

export async function publishCarouselPost(
  args: InstagramCarouselPostArgs,
  onProgress?: (e: UploadProgressEvent) => void,
  onStatus?: (msg: string) => void
): Promise<InstagramImagePostResult> {
  if (args.imagePaths.length < 2 || args.imagePaths.length > 10) {
    throw new Error(`Carousel 需要 2-10 張圖（目前 ${args.imagePaths.length} 張）`);
  }

  const account = getAccountById(args.accountId);
  if (!account) throw new Error(`找不到 IG 帳號 id=${args.accountId}`);
  const igUserId = account.externalId;

  const accessToken = getDecryptedAccessToken(args.accountId);
  if (!accessToken) throw new Error('IG token 不存在，請重新連線');

  const { api_version: apiVersion } = loadCredentials();
  const caption = buildCaption(args.caption, args.hashtags);
  const totalBytes = args.imagePaths.reduce((acc, p) => {
    try {
      return acc + statSync(p).size;
    } catch {
      return acc;
    }
  }, 0);

  console.log(`[instagram] carousel post ${args.imagePaths.length} images to ig_user_id ${igUserId}`);
  onProgress?.({ bytesUploaded: 0, totalBytes, percent: 2 });

  const tunnels: Array<{ url: string; close: () => Promise<void> }> = [];
  try {
    // === Phase 1: 每張圖起 tunnel + 建 child container（並發節省時間）===
    onStatus?.('啟動 cloudflared tunnels...');

    // 一張一張開（不並發，避免太多同時 cloudflared process 互相干擾）
    const childIds: string[] = [];
    for (let i = 0; i < args.imagePaths.length; i++) {
      const path = args.imagePaths[i];
      const ext = path.match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[0] ?? '.jpg';
      const exposedName = `image${i + 1}${ext.toLowerCase()}`;

      const tunnel = await serveFileViaCloudflareTunnel({
        filePath: path,
        exposedName,
        onStatus: i === 0 ? onStatus : undefined // 只第一次顯示「下載 cloudflared」
      });
      tunnels.push(tunnel);

      // v0.6.0：tunnel propagation delay（每張都等，避免 Meta fetch 太早）
      await sleep(3_000);

      const childUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media`;
      try {
        const resp = await axios.post(childUrl, null, {
          params: {
            image_url: tunnel.url,
            is_carousel_item: 'true',
            access_token: accessToken
          }
        });
        const data = resp.data as { id?: string };
        if (!data.id) throw new Error(`第 ${i + 1} 張回應缺 id：${JSON.stringify(resp.data)}`);
        childIds.push(data.id);
        console.log(`[instagram-carousel] child ${i + 1}/${args.imagePaths.length} created, id=${data.id}`);

        const pct = 2 + Math.round(((i + 1) / args.imagePaths.length) * 35);
        onProgress?.({ bytesUploaded: 0, totalBytes, percent: pct });
      } catch (e) {
        throw igError(`create-child-${i + 1}`, e);
      }
    }

    // === Phase 2: 等所有 child 進入 FINISHED（IG 會處理每張）===
    onStatus?.('等待 IG 處理每張子圖...');
    const childStatusBase = `https://graph.facebook.com/${apiVersion}`;
    for (let i = 0; i < childIds.length; i++) {
      const childId = childIds[i];
      let attempts = 0;
      const maxAttempts = 24; // 60s 上限
      let ready = false;
      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          const resp = await axios.get(`${childStatusBase}/${childId}`, {
            params: { fields: 'status_code', access_token: accessToken }
          });
          const data = resp.data as { status_code?: string };
          if (data.status_code === 'FINISHED') {
            ready = true;
            break;
          }
          if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
            throw new Error(`Child container ${i + 1} 處理失敗：${data.status_code}`);
          }
        } catch (e) {
          if (attempts > 3 && e instanceof AxiosError) throw igError(`poll-child-${i + 1}`, e);
        }
        await sleep(2_500);
      }
      if (!ready) throw new Error(`Child container ${i + 1} 處理超時`);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 60 });

    // === Phase 3: 建立 parent CAROUSEL container ===
    const parentUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media`;
    let parentId: string;
    try {
      const resp = await axios.post(parentUrl, null, {
        params: {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: caption.slice(0, 2200),
          access_token: accessToken
        }
      });
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`parent 回應缺 id：${JSON.stringify(resp.data)}`);
      parentId = data.id;
      console.log(`[instagram-carousel] parent created, id=${parentId}`);
    } catch (e) {
      throw igError('create-parent-carousel', e);
    }

    onProgress?.({ bytesUploaded: 0, totalBytes, percent: 75 });

    // === Phase 4: 輪詢 parent 直到 FINISHED ===
    let attempts = 0;
    const maxAttempts = 30;
    let parentReady = false;
    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const resp = await axios.get(`${childStatusBase}/${parentId}`, {
          params: { fields: 'status_code', access_token: accessToken }
        });
        const data = resp.data as { status_code?: string };
        if (data.status_code === 'FINISHED') {
          parentReady = true;
          break;
        }
        if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
          throw new Error(`Parent carousel 處理失敗：${data.status_code}`);
        }
        const pct = Math.min(90, 75 + (attempts / maxAttempts) * 15);
        onProgress?.({ bytesUploaded: 0, totalBytes, percent: pct });
      } catch (e) {
        if (attempts > 3 && e instanceof AxiosError) throw igError('poll-parent-carousel', e);
      }
      await sleep(3_000);
    }
    if (!parentReady) throw new Error('Parent carousel 處理超時');

    // === Phase 5: 發布 ===
    const publishUrl = `https://graph.facebook.com/${apiVersion}/${igUserId}/media_publish`;
    let mediaId: string;
    try {
      const resp = await axios.post(publishUrl, null, {
        params: {
          creation_id: parentId,
          access_token: accessToken
        }
      });
      const data = resp.data as { id?: string };
      if (!data.id) throw new Error(`回應缺 id：${JSON.stringify(resp.data)}`);
      mediaId = data.id;
      console.log(`[instagram-carousel] published, media_id=${mediaId}`);
    } catch (e) {
      throw igError('publish-carousel', e);
    }

    onProgress?.({ bytesUploaded: totalBytes, totalBytes, percent: 100 });

    let permalink = `https://www.instagram.com/p/${mediaId}`;
    try {
      const resp = await axios.get(`${childStatusBase}/${mediaId}`, {
        params: { fields: 'permalink', access_token: accessToken }
      });
      if (resp.data?.permalink) permalink = resp.data.permalink;
    } catch {
      /* fallback */
    }

    return { mediaId, url: permalink };
  } finally {
    // 關掉所有 tunnels
    for (const t of tunnels) {
      await t.close().catch((e) => console.error('[instagram-carousel] tunnel close failed:', e));
    }
  }
}
