/**
 * v0.5.0：tunnel 設定儲存
 * - encrypted_token：用 safeStorage (Windows DPAPI) 加密
 * - public_hostname：明碼（非敏感資訊）
 * - last_verified_at / last_error：「測試連線」結果
 */
import { execute, query, queryOne } from './database';
import { encryptString, decryptString } from './safeStorage';

export type TunnelConfigMode = 'named-cloudflare';

interface TunnelConfigRow {
  id: number;
  mode: string;
  encrypted_token: Uint8Array;
  public_hostname: string;
  last_verified_at: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

/** 對外回傳的型別 — token 還原成明文（僅 main process 內部使用）*/
export interface TunnelConfigInternal {
  id: number;
  mode: TunnelConfigMode;
  token: string;
  publicHostname: string;
  lastVerifiedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 對 renderer 公開的型別 — 不含 token 原文 */
export interface TunnelConfigPublic {
  id: number;
  mode: TunnelConfigMode;
  publicHostname: string;
  hasToken: boolean;
  lastVerifiedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

function rowToInternal(row: TunnelConfigRow): TunnelConfigInternal {
  return {
    id: row.id,
    mode: row.mode as TunnelConfigMode,
    token: decryptString(row.encrypted_token),
    publicHostname: row.public_hostname,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPublic(row: TunnelConfigRow): TunnelConfigPublic {
  return {
    id: row.id,
    mode: row.mode as TunnelConfigMode,
    publicHostname: row.public_hostname,
    hasToken: row.encrypted_token != null && row.encrypted_token.length > 0,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getTunnelConfigInternal(
  mode: TunnelConfigMode
): TunnelConfigInternal | null {
  const row = queryOne<TunnelConfigRow>(
    'SELECT * FROM tunnel_configs WHERE mode = ?',
    [mode]
  );
  return row ? rowToInternal(row) : null;
}

export function getTunnelConfigPublic(
  mode: TunnelConfigMode
): TunnelConfigPublic | null {
  const row = queryOne<TunnelConfigRow>(
    'SELECT * FROM tunnel_configs WHERE mode = ?',
    [mode]
  );
  return row ? rowToPublic(row) : null;
}

export function listTunnelConfigs(): TunnelConfigPublic[] {
  const rows = query<TunnelConfigRow>(
    'SELECT * FROM tunnel_configs ORDER BY id'
  );
  return rows.map(rowToPublic);
}

export function upsertTunnelConfig(input: {
  mode: TunnelConfigMode;
  token: string;
  publicHostname: string;
}): TunnelConfigPublic {
  const encrypted = encryptString(input.token);
  const now = Date.now();
  const existing = queryOne<{ id: number; created_at: number }>(
    'SELECT id, created_at FROM tunnel_configs WHERE mode = ?',
    [input.mode]
  );
  if (existing) {
    execute(
      `UPDATE tunnel_configs SET
         encrypted_token = ?,
         public_hostname = ?,
         last_verified_at = NULL,
         last_error = NULL,
         updated_at = ?
       WHERE mode = ?`,
      [encrypted, input.publicHostname, now, input.mode]
    );
  } else {
    execute(
      `INSERT INTO tunnel_configs
         (mode, encrypted_token, public_hostname, last_verified_at, last_error, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
      [input.mode, encrypted, input.publicHostname, now, now]
    );
  }
  return getTunnelConfigPublic(input.mode)!;
}

export function deleteTunnelConfig(mode: TunnelConfigMode): boolean {
  execute('DELETE FROM tunnel_configs WHERE mode = ?', [mode]);
  return true;
}

export function markTunnelConfigVerified(
  mode: TunnelConfigMode,
  success: boolean,
  errorMessage?: string
): void {
  const now = Date.now();
  if (success) {
    execute(
      `UPDATE tunnel_configs SET
         last_verified_at = ?,
         last_error = NULL,
         updated_at = ?
       WHERE mode = ?`,
      [now, now, mode]
    );
  } else {
    execute(
      `UPDATE tunnel_configs SET
         last_verified_at = NULL,
         last_error = ?,
         updated_at = ?
       WHERE mode = ?`,
      [errorMessage ?? 'unknown error', now, mode]
    );
  }
}
