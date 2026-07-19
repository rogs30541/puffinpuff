/**
 * Meta long-lived user token 自動續期
 *
 * 邏輯：
 * - App 啟動時跑一次 + 每 24 小時跑一次
 * - 對每個 meta_user_tokens 列：
 *    - 若 expires_at - now < 7 天 → 觸發 refresh
 *    - 若 expires_at - now < 0（已過期）→ 仍嘗試 refresh（Meta 文件允許過期後短時間內仍可換）
 * - 成功 → 更新 token + 重抓 /me/accounts 同步所有 FB/IG 帳號 token
 * - 失敗 → 寫入 last_refresh_error + 跳系統通知「請手動到帳號頁重連」
 */

import axios, { AxiosError } from 'axios';
import {
  listAllMetaUserTokens,
  getDecryptedMetaUserToken,
  upsertMetaUserToken,
  recordRefreshError,
  recordRefreshSuccess,
  type MetaUserTokenPublic
} from './metaUserTokens';
import { upsertAccount, getAccountById } from './accountsRepo';
import { loadCredentialsJson } from './credentialsStore';
import { notifySimple } from './notifyService';

interface MetaCredentials {
  app_id: string;
  app_secret: string;
  api_version: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PageData {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
    name?: string;
  };
  picture?: { data: { url: string } };
}

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // < 7 天到期就 refresh
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 每 24 小時檢查一次

let refreshTimer: NodeJS.Timeout | null = null;

function loadCredentials(): MetaCredentials {
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('meta') as MetaCredentials;
}

async function exchangeForLongLived(
  creds: MetaCredentials,
  oldToken: string
): Promise<LongLivedTokenResponse> {
  // 用 fb_exchange_token 把現有 long-lived token 換成新的 60 天 token
  const url = `https://graph.facebook.com/${creds.api_version}/oauth/access_token`;
  const { data } = await axios.get<LongLivedTokenResponse>(url, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: creds.app_id,
      client_secret: creds.app_secret,
      fb_exchange_token: oldToken
    }
  });
  return data;
}

async function fetchPagesWithToken(
  creds: MetaCredentials,
  userToken: string
): Promise<PageData[]> {
  const url = `https://graph.facebook.com/${creds.api_version}/me/accounts`;
  const { data } = await axios.get<{ data: PageData[] }>(url, {
    params: {
      access_token: userToken,
      fields:
        'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
    }
  });
  return data.data ?? [];
}

interface RefreshResult {
  fbUserId: string;
  fbUserName: string | null;
  status: 'refreshed' | 'still-fresh' | 'failed';
  oldExpiresAt: number;
  newExpiresAt?: number;
  /** 該 user 下重抓並更新成功的 Page / IG 帳號數 */
  pagesUpdated?: number;
  error?: string;
}

async function refreshSingleToken(
  creds: MetaCredentials,
  tokenInfo: MetaUserTokenPublic,
  forceRefresh: boolean
): Promise<RefreshResult> {
  const result: RefreshResult = {
    fbUserId: tokenInfo.fbUserId,
    fbUserName: tokenInfo.fbUserName,
    status: 'still-fresh',
    oldExpiresAt: tokenInfo.expiresAt
  };

  // 不到 refresh window 且非強制 → 略過
  if (!forceRefresh && tokenInfo.remainingMs > REFRESH_WINDOW_MS) {
    return result;
  }

  const oldToken = getDecryptedMetaUserToken(tokenInfo.fbUserId);
  if (!oldToken) {
    result.status = 'failed';
    result.error = '本機 token 解密失敗';
    recordRefreshError(tokenInfo.fbUserId, result.error);
    return result;
  }

  try {
    console.log(`[meta-refresh] refreshing for fb_user_id=${tokenInfo.fbUserId} (remaining=${(tokenInfo.remainingMs / 86400000).toFixed(1)}d)`);
    const fresh = await exchangeForLongLived(creds, oldToken);

    const updated = upsertMetaUserToken({
      fbUserId: tokenInfo.fbUserId,
      fbUserName: tokenInfo.fbUserName,
      accessToken: fresh.access_token,
      expiresInSec: fresh.expires_in
    });

    // 重抓 Pages → 順便更新所有 FB / IG 帳號的 Page token
    let pagesUpdated = 0;
    try {
      const pages = await fetchPagesWithToken(creds, fresh.access_token);
      for (const page of pages) {
        upsertAccount({
          platform: 'facebook',
          displayName: page.name,
          externalId: page.id,
          accessToken: page.access_token,
          refreshToken: null,
          expiresAt: null,
          metadata: {
            thumbnail: page.picture?.data.url ?? null,
            userName: tokenInfo.fbUserName,
            userId: tokenInfo.fbUserId
          }
        });
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account;
          upsertAccount({
            platform: 'instagram',
            displayName: ig.username ? `@${ig.username}` : (ig.name ?? '(未命名)'),
            externalId: ig.id,
            accessToken: page.access_token,
            refreshToken: null,
            expiresAt: null,
            metadata: {
              thumbnail: ig.profile_picture_url ?? null,
              linkedPageId: page.id,
              linkedPageName: page.name,
              userName: tokenInfo.fbUserName
            }
          });
        }
        pagesUpdated += 1;
      }
    } catch (e) {
      console.warn('[meta-refresh] re-fetch pages failed (token updated but page tokens not synced):', (e as Error).message);
    }

    recordRefreshSuccess(tokenInfo.fbUserId);
    result.status = 'refreshed';
    result.newExpiresAt = updated.expiresAt;
    result.pagesUpdated = pagesUpdated;
    console.log(`[meta-refresh] OK fb_user_id=${tokenInfo.fbUserId} new expiry=${new Date(updated.expiresAt).toISOString()} pages=${pagesUpdated}`);
  } catch (e) {
    const errMsg = e instanceof AxiosError
      ? `${e.response?.status ?? ''} ${JSON.stringify(e.response?.data ?? {}).slice(0, 200)}`
      : (e as Error).message;
    console.error(`[meta-refresh] FAILED fb_user_id=${tokenInfo.fbUserId}:`, errMsg);
    result.status = 'failed';
    result.error = errMsg;
    recordRefreshError(tokenInfo.fbUserId, errMsg);
  }

  return result;
}

export async function runMetaTokenRefresh(
  options: { force?: boolean } = {}
): Promise<RefreshResult[]> {
  const tokens = listAllMetaUserTokens();
  if (tokens.length === 0) {
    console.log('[meta-refresh] no meta_user_tokens stored, skip');
    return [];
  }

  let creds: MetaCredentials;
  try {
    creds = loadCredentials();
  } catch (e) {
    console.error('[meta-refresh] cannot load credentials:', (e as Error).message);
    return [];
  }

  const results: RefreshResult[] = [];
  for (const t of tokens) {
    const r = await refreshSingleToken(creds, t, options.force ?? false);
    results.push(r);
  }

  // 通知總結
  const refreshed = results.filter((r) => r.status === 'refreshed');
  const failed = results.filter((r) => r.status === 'failed');

  if (refreshed.length > 0) {
    notifySimple(
      'PuffinPuff 已自動續期 Meta 連線',
      `${refreshed.length} 個 Meta 帳號自動換新 60 天 token，發布功能繼續正常使用。`
    );
  }
  if (failed.length > 0) {
    notifySimple(
      'PuffinPuff Meta 連線需要重新授權',
      `${failed.length} 個 Meta 帳號自動續期失敗，請至「帳號」頁重新連結。`
    );
  }

  return results;
}

/** 啟動每日 refresh 排程 */
export function startMetaTokenRefreshSchedule(): void {
  // 啟動時跑一次（背景，不阻塞）
  setTimeout(() => {
    runMetaTokenRefresh().catch((e) => {
      console.warn('[meta-refresh] startup run failed:', e);
    });
  }, 30 * 1000); // 30 秒後跑（讓 App 先穩定）

  // 之後每 24 小時跑一次
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    runMetaTokenRefresh().catch((e) => {
      console.warn('[meta-refresh] interval run failed:', e);
    });
  }, REFRESH_INTERVAL_MS);

  console.log('[meta-refresh] schedule started (every 24h, refresh window 7d)');
}

export function stopMetaTokenRefreshSchedule(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * v0.4.4：根據某個 FB Page / IG account 的 metadata 找出 fbUserId，強制 refresh 該 user 的 token。
 * 用於發布中遇到 auth error 時即時恢復。
 *
 * 回傳 true 表示成功 refresh + Page tokens 已更新。
 */
export async function refreshUserTokenForAccount(accountId: number): Promise<boolean> {
  const account = getAccountById(accountId);
  if (!account) {
    console.warn(`[meta-refresh-on-demand] account #${accountId} not found`);
    return false;
  }
  // FB account metadata 有 userId；IG metadata 有 linkedPageId（沒直接的 userId）
  // 為了簡單，做整批 refresh（runMetaTokenRefresh force=true）
  // 這會 refresh 所有 meta_user_tokens、更新所有 Page tokens
  try {
    const results = await runMetaTokenRefresh({ force: true });
    const anySuccess = results.some((r) => r.status === 'refreshed' || r.status === 'still-fresh');
    if (anySuccess) {
      console.log(`[meta-refresh-on-demand] refreshed for account #${accountId}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[meta-refresh-on-demand] refresh failed:', e);
    return false;
  }
}
