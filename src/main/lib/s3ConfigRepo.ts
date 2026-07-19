/**
 * v0.8.0：S3 相容物件儲存設定（媒體通道抽象化）
 *
 * 支援 Cloudflare R2 / AWS S3 / Backblaze B2 / MinIO 等所有 S3 相容服務。
 * - encrypted_access_key / encrypted_secret_key：safeStorage (Windows DPAPI) 加密
 * - public_base_url：選填；留空 → 用 presigned GET URL（1 小時失效，較安全）
 * - 單列設定（id 恆為 1）
 */
import { execute, queryOne } from './database';
import { encryptString, decryptString } from './safeStorage';

interface S3ConfigRow {
  id: number;
  endpoint: string;
  bucket: string;
  region: string;
  encrypted_access_key: Uint8Array;
  encrypted_secret_key: Uint8Array;
  public_base_url: string | null;
  last_verified_at: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

/** main process 內部用 — 含解密後的 keys */
export interface S3ConfigInternal {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
}

/** renderer 公開用 — 不含 keys 原文 */
export interface S3ConfigPublic {
  endpoint: string;
  bucket: string;
  region: string;
  hasKeys: boolean;
  publicBaseUrl: string | null;
  lastVerifiedAt: number | null;
  lastError: string | null;
}

export function getS3ConfigInternal(): S3ConfigInternal | null {
  const row = queryOne<S3ConfigRow>('SELECT * FROM s3_configs WHERE id = 1');
  if (!row) return null;
  return {
    endpoint: row.endpoint,
    bucket: row.bucket,
    region: row.region,
    accessKeyId: decryptString(row.encrypted_access_key),
    secretAccessKey: decryptString(row.encrypted_secret_key),
    publicBaseUrl: row.public_base_url
  };
}

export function getS3ConfigPublic(): S3ConfigPublic | null {
  const row = queryOne<S3ConfigRow>('SELECT * FROM s3_configs WHERE id = 1');
  if (!row) return null;
  return {
    endpoint: row.endpoint,
    bucket: row.bucket,
    region: row.region,
    hasKeys: row.encrypted_access_key?.length > 0 && row.encrypted_secret_key?.length > 0,
    publicBaseUrl: row.public_base_url,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error
  };
}

export function upsertS3Config(input: {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string | null;
}): S3ConfigPublic {
  const now = Date.now();
  const encryptedAccess = encryptString(input.accessKeyId);
  const encryptedSecret = encryptString(input.secretAccessKey);
  const region = input.region?.trim() || 'auto';
  const publicBaseUrl = input.publicBaseUrl?.trim() || null;
  const existing = queryOne<{ id: number }>('SELECT id FROM s3_configs WHERE id = 1');
  if (existing) {
    execute(
      `UPDATE s3_configs SET
         endpoint = ?, bucket = ?, region = ?,
         encrypted_access_key = ?, encrypted_secret_key = ?,
         public_base_url = ?,
         last_verified_at = NULL, last_error = NULL,
         updated_at = ?
       WHERE id = 1`,
      [input.endpoint.trim(), input.bucket.trim(), region, encryptedAccess, encryptedSecret, publicBaseUrl, now]
    );
  } else {
    execute(
      `INSERT INTO s3_configs
         (id, endpoint, bucket, region, encrypted_access_key, encrypted_secret_key, public_base_url, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.endpoint.trim(), input.bucket.trim(), region, encryptedAccess, encryptedSecret, publicBaseUrl, now, now]
    );
  }
  return getS3ConfigPublic()!;
}

export function deleteS3Config(): boolean {
  execute('DELETE FROM s3_configs WHERE id = 1');
  return true;
}

export function markS3ConfigVerified(success: boolean, errorMessage?: string): void {
  const now = Date.now();
  if (success) {
    execute(
      'UPDATE s3_configs SET last_verified_at = ?, last_error = NULL, updated_at = ? WHERE id = 1',
      [now, now]
    );
  } else {
    execute(
      'UPDATE s3_configs SET last_verified_at = NULL, last_error = ?, updated_at = ? WHERE id = 1',
      [errorMessage ?? 'unknown error', now]
    );
  }
}
