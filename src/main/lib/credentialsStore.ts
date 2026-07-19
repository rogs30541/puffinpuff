/**
 * v0.9.0：OAuth 憑證中央存取層（開源商用版基礎）
 *
 * 三層來源，優先序：
 *  1. DB oauth_credentials 表（使用者在設定頁貼的，DPAPI 加密）
 *  2. secrets/<provider>_oauth.json 檔案（開發者本機 build 的 fallback）
 *     — 讀到時自動匯入 DB（一次性遷移），之後 DB 優先
 *  3. 都沒有 → throw 友善錯誤，指引使用者到設定頁自帶 App credentials
 *
 * 所有原本直接 readFileSync(secrets/...) 的地方一律改走本模組。
 */
import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execute, queryOne } from './database';
import { encryptString, decryptString } from './safeStorage';

export type CredentialProvider = 'google' | 'meta' | 'threads';

const PROVIDER_FILES: Record<CredentialProvider, string> = {
  google: 'google_oauth.json',
  meta: 'meta_oauth.json',
  threads: 'threads_oauth.json'
};

const PROVIDER_LABELS: Record<CredentialProvider, string> = {
  google: 'Google（YouTube）',
  meta: 'Meta（Facebook / Instagram）',
  threads: 'Threads'
};

function secretsFilePath(provider: CredentialProvider): string {
  return join(app.getAppPath(), 'secrets', PROVIDER_FILES[provider]);
}

function readFromDb(provider: CredentialProvider): string | null {
  const row = queryOne<{ encrypted_json: Uint8Array }>(
    'SELECT encrypted_json FROM oauth_credentials WHERE provider = ?',
    [provider]
  );
  if (!row || !row.encrypted_json?.length) return null;
  try {
    return decryptString(row.encrypted_json);
  } catch (e) {
    console.warn(`[credentials] decrypt ${provider} failed:`, (e as Error).message);
    return null;
  }
}

function writeToDb(provider: CredentialProvider, jsonText: string): void {
  const encrypted = encryptString(jsonText);
  const now = Date.now();
  execute(
    `INSERT INTO oauth_credentials (provider, encrypted_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET encrypted_json=excluded.encrypted_json, updated_at=excluded.updated_at`,
    [provider, encrypted, now]
  );
}

/** 必要欄位驗證（儲存時 + 匯入時） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateShape(provider: CredentialProvider, parsed: any): string | null {
  if (!parsed || typeof parsed !== 'object') return 'JSON 內容不是物件';
  if (provider === 'google') {
    if (!parsed.installed?.client_id) return '缺 installed.client_id（Google Desktop OAuth client JSON）';
    if (!parsed.installed?.client_secret) return '缺 installed.client_secret';
  }
  if (provider === 'meta') {
    if (!parsed.app_id) return '缺 app_id';
    if (!parsed.app_secret) return '缺 app_secret';
    if (!parsed.api_version) return '缺 api_version（例 v21.0）';
  }
  if (provider === 'threads') {
    if (!parsed.app_id) return '缺 app_id';
    if (!parsed.app_secret) return '缺 app_secret';
    if (!parsed.api_version) return '缺 api_version（例 v1.0）';
    if (!parsed.redirect_uri) return '缺 redirect_uri';
  }
  return null;
}

/**
 * 主要入口：載入某 provider 的憑證 JSON（已 parse 的物件）。
 * 所有 OAuth flow / adapter / stats / token refresher 都走這裡。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadCredentialsJson(provider: CredentialProvider): any {
  // 1. DB 優先
  const fromDb = readFromDb(provider);
  if (fromDb) {
    return JSON.parse(fromDb);
  }

  // 2. secrets 檔案 fallback + 自動匯入 DB
  const filePath = secretsFilePath(provider);
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const invalid = validateShape(provider, parsed);
    if (!invalid) {
      try {
        writeToDb(provider, raw);
        console.log(`[credentials] ${provider} 從 secrets 檔案自動匯入 DB（一次性遷移）`);
      } catch (e) {
        console.warn(`[credentials] auto-import ${provider} failed:`, (e as Error).message);
      }
    }
    return parsed;
  }

  // 3. 都沒有 → 友善指引
  throw new Error(
    `尚未設定 ${PROVIDER_LABELS[provider]} 的 App 憑證。\n\n` +
    `請至「設定 → OAuth 憑證（自帶 App）」貼入你自己的 App credentials JSON。\n` +
    `設定頁內有申請教學（Google Cloud Console / Meta Developer Dashboard）。`
  );
}

// ===== 設定頁用的管理 API =====

export interface CredentialStatus {
  provider: CredentialProvider;
  configured: boolean;
  /** 'db' = 使用者設定；'file' = 內建 secrets 檔案；null = 未設定 */
  source: 'db' | 'file' | null;
  /** 遮罩後的摘要（app_id / client_id 前段，不含 secret）*/
  summary: string | null;
  updatedAt: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(provider: CredentialProvider, parsed: any): string {
  try {
    if (provider === 'google') {
      const id = String(parsed.installed?.client_id ?? '');
      return `client_id: ${id.slice(0, 20)}...`;
    }
    return `app_id: ${String(parsed.app_id ?? '?')}`;
  } catch {
    return '(無法解析)';
  }
}

export function getCredentialStatus(provider: CredentialProvider): CredentialStatus {
  const row = queryOne<{ encrypted_json: Uint8Array; updated_at: number }>(
    'SELECT encrypted_json, updated_at FROM oauth_credentials WHERE provider = ?',
    [provider]
  );
  if (row?.encrypted_json?.length) {
    try {
      const parsed = JSON.parse(decryptString(row.encrypted_json));
      return {
        provider,
        configured: true,
        source: 'db',
        summary: summarize(provider, parsed),
        updatedAt: row.updated_at
      };
    } catch {
      /* decrypt 失敗 → 當未設定，往下看檔案 */
    }
  }
  const filePath = secretsFilePath(provider);
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
      // stub 檔（REPLACE_WITH_... placeholder）不算已設定
      const invalid = validateShape(provider, parsed);
      const looksStub = JSON.stringify(parsed).includes('REPLACE_WITH');
      if (!invalid && !looksStub) {
        return {
          provider,
          configured: true,
          source: 'file',
          summary: summarize(provider, parsed),
          updatedAt: null
        };
      }
    } catch {
      /* 檔案壞掉 → 當未設定 */
    }
  }
  return { provider, configured: false, source: null, summary: null, updatedAt: null };
}

export function getAllCredentialStatuses(): CredentialStatus[] {
  return (['google', 'meta', 'threads'] as const).map(getCredentialStatus);
}

export function saveCredentials(provider: CredentialProvider, jsonText: string): CredentialStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`JSON 格式錯誤：${(e as Error).message}`);
  }
  const invalid = validateShape(provider, parsed);
  if (invalid) {
    throw new Error(`${PROVIDER_LABELS[provider]} 憑證缺少必要欄位：${invalid}`);
  }
  writeToDb(provider, jsonText);
  return getCredentialStatus(provider);
}

export function deleteCredentials(provider: CredentialProvider): CredentialStatus {
  execute('DELETE FROM oauth_credentials WHERE provider = ?', [provider]);
  return getCredentialStatus(provider);
}
