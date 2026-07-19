/**
 * v0.5.0：通用 app 設定 key-value 儲存
 * 不適合放敏感資料（無加密）—— token / 密碼類請用對應 repo + safeStorage
 */
import { execute, queryOne } from './database';

export function getSetting(key: string): string | null {
  const row = queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const now = Date.now();
  execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [key, value, now]
  );
}

export function deleteSetting(key: string): void {
  execute('DELETE FROM app_settings WHERE key = ?', [key]);
}

// ===== 型別安全的 typed accessors =====

/** v0.8.0：加 's3'（雲端物件儲存）— 沿用同一個設定 key，舊值向後相容 */
export type TunnelMode = 'quick' | 'named-cloudflare' | 's3';

const TUNNEL_MODE_KEY = 'tunnel_mode';

export function getTunnelMode(): TunnelMode {
  const v = getSetting(TUNNEL_MODE_KEY);
  if (v === 'named-cloudflare') return 'named-cloudflare';
  if (v === 's3') return 's3';
  return 'quick';
}

export function setTunnelMode(mode: TunnelMode): void {
  setSetting(TUNNEL_MODE_KEY, mode);
}
