import { execute, insertAndGetId, query, queryOne } from './database';
import { decryptString, encryptString } from './safeStorage';
import type { AccountPublic, Platform } from '../../shared/types';

export type { AccountPublic, Platform };

export interface AccountRow {
  id: number;
  platform: Platform;
  display_name: string;
  external_id: string;
  expires_at: number | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface UpsertAccountInput {
  platform: Platform;
  displayName: string;
  externalId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  metadata?: Record<string, unknown>;
}

function toPublic(row: AccountRow): AccountPublic {
  return {
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    externalId: row.external_id,
    expiresAt: row.expires_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listAccounts(): AccountPublic[] {
  const rows = query<AccountRow>(
    'SELECT id, platform, display_name, external_id, expires_at, metadata, created_at, updated_at FROM accounts ORDER BY platform, created_at DESC'
  );
  return rows.map(toPublic);
}

export function listAccountsByPlatform(platform: Platform): AccountPublic[] {
  const rows = query<AccountRow>(
    'SELECT id, platform, display_name, external_id, expires_at, metadata, created_at, updated_at FROM accounts WHERE platform = ? ORDER BY created_at DESC',
    [platform]
  );
  return rows.map(toPublic);
}

export function getAccountById(id: number): AccountPublic | null {
  const row = queryOne<AccountRow>(
    'SELECT id, platform, display_name, external_id, expires_at, metadata, created_at, updated_at FROM accounts WHERE id = ?',
    [id]
  );
  return row ? toPublic(row) : null;
}

export function upsertAccount(input: UpsertAccountInput): AccountPublic {
  const now = Date.now();
  const accessEncrypted = encryptString(input.accessToken);
  const refreshEncrypted = input.refreshToken ? encryptString(input.refreshToken) : null;
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  const existing = queryOne<{ id: number }>(
    'SELECT id FROM accounts WHERE platform = ? AND external_id = ?',
    [input.platform, input.externalId]
  );

  if (existing) {
    execute(
      `UPDATE accounts SET
        display_name = ?,
        access_token_encrypted = ?,
        refresh_token_encrypted = ?,
        expires_at = ?,
        metadata = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        input.displayName,
        accessEncrypted,
        refreshEncrypted,
        input.expiresAt ?? null,
        metadataJson,
        now,
        existing.id
      ]
    );
    return getAccountById(existing.id)!;
  }

  const id = insertAndGetId(
    `INSERT INTO accounts (
      platform, display_name, external_id,
      access_token_encrypted, refresh_token_encrypted,
      expires_at, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.platform,
      input.displayName,
      input.externalId,
      accessEncrypted,
      refreshEncrypted,
      input.expiresAt ?? null,
      metadataJson,
      now,
      now
    ]
  );
  return getAccountById(id)!;
}

export function deleteAccount(id: number): void {
  execute('DELETE FROM accounts WHERE id = ?', [id]);
}

export function getDecryptedAccessToken(id: number): string | null {
  const row = queryOne<{ access_token_encrypted: Uint8Array | null }>(
    'SELECT access_token_encrypted FROM accounts WHERE id = ?',
    [id]
  );
  if (!row?.access_token_encrypted) return null;
  return decryptString(row.access_token_encrypted);
}

export function getDecryptedRefreshToken(id: number): string | null {
  const row = queryOne<{ refresh_token_encrypted: Uint8Array | null }>(
    'SELECT refresh_token_encrypted FROM accounts WHERE id = ?',
    [id]
  );
  if (!row?.refresh_token_encrypted) return null;
  return decryptString(row.refresh_token_encrypted);
}
