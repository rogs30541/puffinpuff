/**
 * v0.4.4：Meta 錯誤類型偵測器
 * 把 Meta API 的錯誤 code / 訊息分類，方便：
 *  1. Auth Error → 觸發 token refresh + 重試
 *  2. Quota / Rate limit → 顯示友善的「請等 X 小時」
 *  3. 其他永久錯誤 → 直接 fail
 */

import { AxiosError } from 'axios';

export type MetaErrorKind =
  | 'auth' // 401/403、code 190 → token 失效，應該 refresh
  | 'quota' // code 4/17/32/613/80004 → rate limit / 配額用完
  | 'permission' // code 200/210 → 權限不足
  | 'invalid' // code 100 → 參數錯誤
  | 'transient' // 5xx / 網路 → 重試可能成功
  | 'unknown';

export interface ParsedMetaError {
  kind: MetaErrorKind;
  code?: number;
  subcode?: number;
  message: string;
  /** 給使用者看的友善訊息（中文）*/
  friendlyMessage: string;
  /** quota 類型才有：建議重試的秒數 */
  retryAfterSec?: number;
}

const QUOTA_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80004, 80005, 80006, 80007, 80008, 80009, 80014]);
const AUTH_CODES = new Set([190, 102]);
const PERMISSION_CODES = new Set([200, 210, 230, 290]);

export function parseMetaError(e: unknown): ParsedMetaError {
  // 不是 AxiosError → 看訊息字串
  // v0.5.4：不再把 'OAuthException' 字串視為 auth（Meta 對非授權錯誤也回 OAuthException type）
  if (!(e instanceof AxiosError)) {
    const msg = (e as Error)?.message ?? String(e);
    return {
      kind: 'unknown',
      message: msg,
      friendlyMessage: msg
    };
  }

  const status = e.response?.status;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = e.response?.data;
  const inner = data?.error ?? {};
  const code: number | undefined = inner.code;
  const subcode: number | undefined = inner.error_subcode;
  const rawMsg: string = inner.message ?? JSON.stringify(data ?? '').slice(0, 300);

  // 1. Quota / rate limit
  if (code !== undefined && QUOTA_CODES.has(code)) {
    // IG 特殊 quota：80004 = 24h 內超過 25 篇
    const isIgPublishQuota = code === 80004;
    return {
      kind: 'quota',
      code,
      subcode,
      message: rawMsg,
      friendlyMessage: isIgPublishQuota
        ? '已達 IG 24 小時 25 篇發布配額上限，請等待恢復（最久 24 小時）'
        : `Meta API 暫時超過呼叫上限（code=${code}），系統會自動退避重試；如持續失敗請等 15 分鐘`,
      retryAfterSec: isIgPublishQuota ? 3600 : 900
    };
  }

  // 2. Auth error → token 失效（v0.5.4：收緊條件，避免把 OAuthException-typed 內容錯誤誤判為 auth）
  //    只認 HTTP 401 或 Meta 明確 auth code（190/102）才算
  //    OAuthException 是 Meta 的萬用錯誤類型，很多 IG 內容/格式錯誤都會回它，不能當 auth
  if (
    status === 401 ||
    (code !== undefined && AUTH_CODES.has(code))
  ) {
    return {
      kind: 'auth',
      code,
      subcode,
      message: rawMsg,
      friendlyMessage: `Meta 授權失效（code=${code ?? '?'}）：${rawMsg.slice(0, 120)}—— 系統會嘗試自動續期，若仍失敗請至帳號頁重新連結 Meta`
    };
  }

  // 3. Permission
  if (code !== undefined && PERMISSION_CODES.has(code)) {
    return {
      kind: 'permission',
      code,
      subcode,
      message: rawMsg,
      friendlyMessage: `Meta 權限不足（code=${code}）：${rawMsg.slice(0, 80)}—— 請至帳號頁重新連結並確認所有權限都勾選`
    };
  }

  // 4. Invalid params (code 100) — v0.6.6：完整帶出 type/subcode/fbtrace_id/error_user_msg
  if (code === 100) {
    const type = inner.type ?? '?';
    const fbtrace = inner.fbtrace_id ?? '?';
    const userMsg = inner.error_user_msg ?? inner.error_user_title ?? '';
    const extraDetail = userMsg ? `\n[Meta 給使用者的訊息]：${userMsg}` : '';
    return {
      kind: 'invalid',
      code,
      subcode,
      message: rawMsg,
      friendlyMessage:
        `Meta code=100 ${type}${subcode !== undefined ? `/${subcode}` : ''} ` +
        `fbtrace=${fbtrace}\n[原始訊息]：${rawMsg}${extraDetail}\n\n` +
        `常見原因：(1) caption 超過 2200 字 (2) 影片格式不符 IG Reels 規格 (3) hashtag 超過 30 個 ` +
        `(4) IG 帳號被 Meta 限制 publish (5) dev mode 對 instagram_content_publish 的硬限制`
    };
  }

  // 5. Transient
  if (status && status >= 500) {
    return {
      kind: 'transient',
      message: rawMsg,
      friendlyMessage: `Meta server 暫時異常（HTTP ${status}），系統會自動重試`
    };
  }

  // v0.5.4：把 type / code / subcode 都帶出來給使用者看，不要遮蓋真實錯誤
  const typeStr = inner.type ? `type=${inner.type} ` : '';
  const codeStr = code !== undefined ? `code=${code}${subcode !== undefined ? `/${subcode}` : ''} ` : '';
  return {
    kind: 'unknown',
    code,
    subcode,
    message: rawMsg,
    friendlyMessage: `Meta API 錯誤（${typeStr}${codeStr}HTTP ${status ?? '?'}）：${rawMsg.slice(0, 250)}`
  };
}

export function isMetaAuthError(e: unknown): boolean {
  return parseMetaError(e).kind === 'auth';
}

export function isMetaQuotaError(e: unknown): boolean {
  return parseMetaError(e).kind === 'quota';
}
