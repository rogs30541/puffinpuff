/**
 * Meta long-lived user token 倉庫
 *
 * 此 token 是 OAuth 後換到的 60 天 user-level token，用於：
 * 1. 取得使用者的粉專清單（POST /me/accounts）
 * 2. 衍生 Page access token（不會過期，但前提是 user token 還活著）
 * 3. **本 token 本身 60 天到期**，必須在到期前用同一支 token 去 `fb_exchange_token` 換一支新的 60 天 token
 *
 * v0.2.5 新增。原本程式只保留 Page token 沒留 user token，
 * 因此首次升級到 0.2.5 的使用者必須**重新連結 Meta 帳號**才能啟用自動續期。
 */

import { execute, query, queryOne, flushDatabase } from './database';
import { encryptString, decryptString } from './safeStorage';

export interface MetaUserTokenRow {
  id: number;
  fb_user_id: string;
  fb_user_name: string | null;
  access_token_encrypted: Uint8Array;
  expires_at: number;
  last_refresh_at: number | null;
  last_refresh_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface MetaUserTokenPublic {
  id: number;
  fbUserId: string;
  fbUserName: string | null;
  expiresAt: number;
  /** ms remaining until expiry; negative if expired */
  remainingMs: number;
  lastRefreshAt: number | null;
  lastRefreshError: string | null;
  createdAt: number;
  updatedAt: number;
}

function toPublic(row: MetaUserTokenRow): MetaUserTokenPublic {
  return {
    id: row.id,
    fbUserId: row.fb_user_id,
    fbUserName: row.fb_user_name,
    expiresAt: row.expires_at,
    remainingMs: row.expires_at - Date.now(),
    lastRefreshAt: row.last_refresh_at,
    lastRefreshError: row.last_refresh_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * 寫入或更新 user-level token。OAuth 完成、refresh 成功時都會呼叫。
 */
export function upsertMetaUserToken(input: {
  fbUserId: string;
  fbUserName: string | null;
  accessToken: string;
  /** 從現在算起多少秒後到期，預設 60 天 */
  expiresInSec?: number;
}): MetaUserTokenPublic {
  const now = Date.now();
  const expiresInSec = input.expiresInSec ?? 60 * 24 * 60 * 60; // 60 天
  const expiresAt = now + expiresInSec * 1000;
  const encrypted = encryptString(input.accessToken);

  const existing = queryOne<{ id: number }>(
    'SELECT id FROM meta_user_tokens WHERE fb_user_id = ?',
    [input.fbUserId]
  );

  if (existing) {
    execute(
      `UPDATE meta_user_tokens SET
        fb_user_name = ?,
        access_token_encrypted = ?,
        expires_at = ?,
        last_refresh_error = NULL,
        updated_at = ?
      WHERE id = ?`,
      [input.fbUserName, encrypted, expiresAt, now, existing.id]
    );
  } else {
    execute(
      `INSERT INTO meta_user_tokens (
        fb_user_id, fb_user_name, access_token_encrypted,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.fbUserId, input.fbUserName, encrypted, expiresAt, now, now]
    );
  }
  flushDatabase();

  return getMetaUserTokenByFbId(input.fbUserId)!;
}

export function getMetaUserTokenByFbId(fbUserId: string): MetaUserTokenPublic | null {
  const row = queryOne<MetaUserTokenRow>(
    'SELECT * FROM meta_user_tokens WHERE fb_user_id = ?',
    [fbUserId]
  );
  return row ? toPublic(row) : null;
}

export function listAllMetaUserTokens(): MetaUserTokenPublic[] {
  const rows = query<MetaUserTokenRow>('SELECT * FROM meta_user_tokens ORDER BY expires_at ASC');
  return rows.map(toPublic);
}

export function getDecryptedMetaUserToken(fbUserId: string): string | null {
  const row = queryOne<{ access_token_encrypted: Uint8Array }>(
    'SELECT access_token_encrypted FROM meta_user_tokens WHERE fb_user_id = ?',
    [fbUserId]
  );
  if (!row?.access_token_encrypted) return null;
  return decryptString(row.access_token_encrypted);
}

export function deleteMetaUserToken(fbUserId: string): void {
  execute('DELETE FROM meta_user_tokens WHERE fb_user_id = ?', [fbUserId]);
  flushDatabase();
}

/** 記錄 refresh 失敗原因（讓 UI 與下次 GC 知道狀態） */
export function recordRefreshError(fbUserId: string, errorMessage: string): void {
  execute(
    'UPDATE meta_user_tokens SET last_refresh_error = ?, updated_at = ? WHERE fb_user_id = ?',
    [errorMessage.slice(0, 500), Date.now(), fbUserId]
  );
  flushDatabase();
}

/** 記錄 refresh 成功時間 */
export function recordRefreshSuccess(fbUserId: string): void {
  execute(
    'UPDATE meta_user_tokens SET last_refresh_at = ?, last_refresh_error = NULL, updated_at = ? WHERE fb_user_id = ?',
    [Date.now(), Date.now(), fbUserId]
  );
  flushDatabase();
}
