/**
 * v0.7.0：Threads OAuth flow
 *
 * Threads API 使用獨立 OAuth（不同於 FB/IG）：
 *  - Authorize URL：https://threads.net/oauth/authorize
 *  - Token endpoint：https://graph.threads.net/oauth/access_token
 *  - Long-lived exchange：https://graph.threads.net/access_token?grant_type=th_exchange_token
 *  - Me endpoint：https://graph.threads.net/v1.0/me
 *
 * Scopes:
 *  - threads_basic（讀）
 *  - threads_content_publish（寫）
 *  - threads_manage_insights（可選，抓觸及數據用）
 */
import { app, BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import axios from 'axios';
import { upsertAccount, type AccountPublic } from '../lib/accountsRepo';

interface ThreadsCredentials {
  app_id: string;
  app_secret: string;
  api_version: string;
  redirect_uri: string;
  scopes: string[];
}

interface ShortLivedTokenResponse {
  access_token: string;
  user_id: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ThreadsMeResponse {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

let activeAuthWindow: BrowserWindow | null = null;

function loadCredentials(): ThreadsCredentials {
  const path = join(app.getAppPath(), 'secrets', 'threads_oauth.json');
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ThreadsCredentials;
}

function buildAuthUrl(creds: ThreadsCredentials, state: string): string {
  const params = new URLSearchParams({
    client_id: creds.app_id,
    redirect_uri: creds.redirect_uri,
    scope: creds.scopes.join(','),
    response_type: 'code',
    state
  });
  return `https://threads.net/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForShortToken(
  creds: ThreadsCredentials,
  code: string
): Promise<ShortLivedTokenResponse> {
  const url = `https://graph.threads.net/oauth/access_token`;
  // Threads token endpoint 要用 form-urlencoded POST body
  const form = new URLSearchParams({
    client_id: creds.app_id,
    client_secret: creds.app_secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: creds.redirect_uri
  });
  const { data } = await axios.post<ShortLivedTokenResponse>(url, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data;
}

async function exchangeForLongLived(
  creds: ThreadsCredentials,
  shortToken: string
): Promise<LongLivedTokenResponse> {
  const url = `https://graph.threads.net/access_token`;
  const { data } = await axios.get<LongLivedTokenResponse>(url, {
    params: {
      grant_type: 'th_exchange_token',
      client_secret: creds.app_secret,
      access_token: shortToken
    }
  });
  return data;
}

async function fetchMe(
  creds: ThreadsCredentials,
  token: string
): Promise<ThreadsMeResponse> {
  const url = `https://graph.threads.net/${creds.api_version}/me`;
  const { data } = await axios.get<ThreadsMeResponse>(url, {
    params: {
      access_token: token,
      fields: 'id,username,name,threads_profile_picture_url'
    }
  });
  return data;
}

export interface ThreadsConnectResult {
  user: ThreadsMeResponse;
  threadsAccounts: AccountPublic[];
}

export async function connectThreadsAccount(): Promise<ThreadsConnectResult> {
  if (activeAuthWindow) {
    throw new Error('已有進行中的 Threads 授權流程，請完成或取消後再試');
  }

  const creds = loadCredentials();
  const state = randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(creds, state);
  console.log('[threads-oauth] opening dialog:', authUrl);

  const parent = BrowserWindow.getAllWindows()[0];
  const oauthWin = new BrowserWindow({
    parent,
    modal: true,
    width: 600,
    height: 760,
    title: 'PuffinPuff - Threads 授權',
    autoHideMenuBar: true,
    backgroundColor: '#FBF7F2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  });

  oauthWin.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  if (!app.isPackaged) {
    oauthWin.webContents.openDevTools({ mode: 'detach' });
  }
  activeAuthWindow = oauthWin;

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;

    function handleNavigation(url: string, eventLike?: Electron.Event): void {
      if (settled) return;
      if (!url.startsWith(creds.redirect_uri)) return;
      eventLike?.preventDefault();
      try {
        const parsed = new URL(url);
        const returnedCode = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        const errorParam = parsed.searchParams.get('error');
        const errorDesc = parsed.searchParams.get('error_description');

        if (errorParam) {
          settled = true;
          reject(new Error(`Threads 授權拒絕：${errorDesc || errorParam}`));
          return;
        }
        if (returnedState !== state) {
          settled = true;
          reject(new Error('OAuth state 不一致（可能遭中間人攻擊），請重試'));
          return;
        }
        if (!returnedCode) {
          settled = true;
          reject(new Error('Threads 未回傳授權 code'));
          return;
        }
        settled = true;
        resolve(returnedCode);
      } finally {
        if (!oauthWin.isDestroyed()) oauthWin.close();
      }
    }

    oauthWin.webContents.on('will-redirect', (event, url) => handleNavigation(url, event));
    oauthWin.webContents.on('will-navigate', (event, url) => handleNavigation(url, event));

    oauthWin.on('closed', () => {
      activeAuthWindow = null;
      if (!settled) {
        settled = true;
        reject(new Error('使用者關閉授權視窗'));
      }
    });

    oauthWin.loadURL(authUrl).catch((e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
  });

  // 1. 短期 token
  const shortLived = await exchangeCodeForShortToken(creds, code);
  // 2. 換長期 token（60 天）
  const longLived = await exchangeForLongLived(creds, shortLived.access_token);
  // 3. 取得使用者資料
  const me = await fetchMe(creds, longLived.access_token);

  // 4. 寫進 accounts DB
  const account = upsertAccount({
    platform: 'threads',
    displayName: me.username ? `@${me.username}` : (me.name ?? `(未命名 ${me.id})`),
    externalId: me.id,
    accessToken: longLived.access_token,
    refreshToken: null,
    expiresAt: Date.now() + longLived.expires_in * 1000,
    metadata: {
      thumbnail: me.threads_profile_picture_url ?? null,
      username: me.username,
      name: me.name
    }
  });

  return { user: me, threadsAccounts: [account] };
}

export function cancelThreadsAuth(): void {
  if (activeAuthWindow && !activeAuthWindow.isDestroyed()) {
    activeAuthWindow.close();
  }
  activeAuthWindow = null;
}
