/**
 * v0.4.0：發布失敗自動重試（指數退避）
 *
 * 只重試「transient errors」：
 *  - 網路相關（ECONNRESET / ETIMEDOUT / DNS 失敗）
 *  - HTTP 429（rate limit）
 *  - HTTP 5xx（server error）
 *
 * 不重試「permanent errors」：
 *  - HTTP 4xx（除 429）：通常是 token 失效 / 內容違規 / 參數錯誤
 *  - 業務邏輯錯誤（例如 IG container ERROR/EXPIRED）
 *
 * 預設：最多 3 次重試，間隔 2s / 4s / 8s
 */

import { AxiosError } from 'axios';

export interface RetryOptions {
  /** 最大重試次數（不含第 1 次嘗試），預設 3 */
  maxRetries?: number;
  /** 初始退避（ms），預設 2000 */
  initialDelayMs?: number;
  /** 退避倍數，預設 2 */
  backoffFactor?: number;
  /** 進度回呼，每次重試前呼叫 */
  onRetry?: (attempt: number, lastError: Error, nextDelayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判斷錯誤是否為 transient（可重試）。
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // 沒有 response = 網路層失敗
    if (!error.response) {
      return true;
    }
    const status = error.response.status;
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  // 普通 Error：看 message 關鍵字
  const msg = (error as Error)?.message ?? '';
  if (
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ENETUNREACH') ||
    msg.includes('socket hang up') ||
    msg.includes('aborted')
  ) {
    return true;
  }
  return false;
}

/**
 * 把任何 async function 包成有「指數退避自動重試」的版本。
 *
 * 用法：
 *   const result = await withRetry(
 *     () => apiCall(),
 *     { onRetry: (n, err, delay) => console.log(...) }
 *   );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 2000;
  const backoffFactor = options.backoffFactor ?? 2;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt >= maxRetries) {
        // 最後一次了，往外丟
        throw lastError;
      }
      if (!isTransientError(e)) {
        // 永久錯誤，不重試
        throw lastError;
      }
      const delay = initialDelay * Math.pow(backoffFactor, attempt);
      console.warn(
        `[retry] attempt ${attempt + 1}/${maxRetries + 1} failed (transient), retrying in ${delay}ms: ${lastError.message}`
      );
      options.onRetry?.(attempt + 1, lastError, delay);
      await sleep(delay);
    }
  }
  // 邏輯上不會到這裡
  throw lastError ?? new Error('Unknown retry failure');
}
