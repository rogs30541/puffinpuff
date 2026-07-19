import { ipcMain } from 'electron';
import axios from 'axios';
import { google } from 'googleapis';
import {
  deleteAccount,
  getAccountById,
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  listAccounts,
  type AccountPublic
} from '../lib/accountsRepo';
import { cancelGoogleAuth, connectGoogleAccount } from '../oauth/googleOAuth';
import { cancelMetaAuth, connectMetaAccount, type MetaConnectResult } from '../oauth/metaOAuth';
import { cancelThreadsAuth, connectThreadsAccount, type ThreadsConnectResult } from '../oauth/threadsOAuth';
import { parseMetaError } from '../lib/metaErrorHelpers';
import { loadCredentialsJson } from '../lib/credentialsStore';

export interface AccountTestResult {
  ok: boolean;
  displayName?: string;
  latencyMs: number;
  message: string;
}

export function registerAccountsHandlers(): void {
  ipcMain.handle('accounts:list', (): AccountPublic[] => listAccounts());

  ipcMain.handle('accounts:connectGoogle', async (): Promise<AccountPublic> => {
    const result = await connectGoogleAccount();
    return result.account;
  });

  ipcMain.handle('accounts:cancelGoogleAuth', (): boolean => {
    cancelGoogleAuth();
    return true;
  });

  ipcMain.handle('accounts:connectMeta', async (): Promise<MetaConnectResult> => {
    return await connectMetaAccount();
  });

  ipcMain.handle('accounts:cancelMetaAuth', (): boolean => {
    cancelMetaAuth();
    return true;
  });

  // v0.7.0：Threads OAuth
  ipcMain.handle('accounts:connectThreads', async (): Promise<ThreadsConnectResult> => {
    return await connectThreadsAccount();
  });

  ipcMain.handle('accounts:cancelThreadsAuth', (): boolean => {
    cancelThreadsAuth();
    return true;
  });

  ipcMain.handle('accounts:disconnect', (_event, id: number): boolean => {
    deleteAccount(id);
    return true;
  });

  // v0.6.8：debug_token — 查 Meta token 實際的 scope（OAuth 同意 ≠ 實際給）
  ipcMain.handle(
    'accounts:debugMetaToken',
    async (_event, accountId: number): Promise<{ ok: boolean; data?: unknown; message: string }> => {
      const account = getAccountById(accountId);
      if (!account || (account.platform !== 'facebook' && account.platform !== 'instagram')) {
        return { ok: false, message: '帳號不存在或非 Meta 平台' };
      }
      const token = getDecryptedAccessToken(account.id);
      if (!token) {
        return { ok: false, message: 'Token 不存在' };
      }
      try {
        // v0.9.0：走中央憑證層
        const creds = loadCredentialsJson('meta') as {
          app_id: string;
          app_secret: string;
          api_version: string;
        };
        const appAccessToken = `${creds.app_id}|${creds.app_secret}`;
        const resp = await axios.get(`https://graph.facebook.com/debug_token`, {
          params: { input_token: token, access_token: appAccessToken }
        });
        console.log(`[debug_token] response for account #${accountId}:`, JSON.stringify(resp.data, null, 2));
        return {
          ok: true,
          data: resp.data,
          message: `查詢成功 — scopes: ${JSON.stringify((resp.data as { data?: { scopes?: string[] } })?.data?.scopes ?? [])}`
        };
      } catch (e) {
        const parsed = parseMetaError(e);
        return { ok: false, message: parsed.friendlyMessage };
      }
    }
  );

  // v0.4.4：測試帳號連線
  ipcMain.handle(
    'accounts:testConnection',
    async (_event, accountId: number): Promise<AccountTestResult> => {
      const account = getAccountById(accountId);
      if (!account) {
        return { ok: false, latencyMs: 0, message: '帳號不存在於本機' };
      }
      const startedAt = Date.now();
      try {
        if (account.platform === 'youtube') {
          const accessToken = getDecryptedAccessToken(accountId);
          const refreshToken = getDecryptedRefreshToken(accountId);
          if (!accessToken) throw new Error('access token 不存在');
          const creds = loadCredentialsJson('google') as {
            installed: { client_id: string; client_secret: string };
          };
          const oauth2Client = new google.auth.OAuth2(
            creds.installed.client_id,
            creds.installed.client_secret
          );
          oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken ?? undefined
          });
          const yt = google.youtube({ version: 'v3', auth: oauth2Client });
          const resp = await yt.channels.list({ part: ['snippet'], mine: true });
          const channelName = resp.data.items?.[0]?.snippet?.title ?? account.displayName;
          return {
            ok: true,
            displayName: channelName,
            latencyMs: Date.now() - startedAt,
            message: `YouTube 連線正常（${channelName}）`
          };
        }
        if (account.platform === 'facebook' || account.platform === 'instagram') {
          const accessToken = getDecryptedAccessToken(accountId);
          if (!accessToken) throw new Error('token 不存在');
          const creds = loadCredentialsJson('meta') as {
            api_version: string;
          };
          const externalId = account.externalId;
          const fields = account.platform === 'instagram'
            ? 'id,username'
            : 'id,name,verification_status';
          const resp = await axios.get(
            `https://graph.facebook.com/${creds.api_version}/${externalId}`,
            { params: { fields, access_token: accessToken } }
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = resp.data as any;
          const displayName = account.platform === 'instagram'
            ? (data.username ? `@${data.username}` : account.displayName)
            : (data.name ?? account.displayName);
          return {
            ok: true,
            displayName,
            latencyMs: Date.now() - startedAt,
            message: `${account.platform === 'instagram' ? 'IG' : 'FB'} 連線正常（${displayName}）`
          };
        }
        return { ok: false, latencyMs: Date.now() - startedAt, message: `不支援的平台：${account.platform}` };
      } catch (e) {
        const latencyMs = Date.now() - startedAt;
        if (account.platform === 'facebook' || account.platform === 'instagram') {
          const parsed = parseMetaError(e);
          return {
            ok: false,
            latencyMs,
            message: parsed.friendlyMessage
          };
        }
        return {
          ok: false,
          latencyMs,
          message: (e as Error).message ?? String(e)
        };
      }
    }
  );
}
