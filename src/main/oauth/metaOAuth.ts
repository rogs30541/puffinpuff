import { app, BrowserWindow } from 'electron';
import { randomBytes } from 'node:crypto';
import axios from 'axios';
import { upsertAccount, type AccountPublic } from '../lib/accountsRepo';
import { loadCredentialsJson } from '../lib/credentialsStore';
import { upsertMetaUserToken } from '../lib/metaUserTokens';

interface MetaCredentials {
  app_id: string;
  app_secret: string;
  config_id: string;
  api_version: string;
  redirect_uri: string;
  scopes: string[];
}

interface ShortLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MeResponse {
  id: string;
  name: string;
}

interface PageData {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
    name?: string;
  };
  picture?: { data: { url: string } };
}

let activeAuthWindow: BrowserWindow | null = null;

function loadCredentials(): MetaCredentials {
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('meta') as MetaCredentials;
}

function buildAuthUrl(
  creds: MetaCredentials,
  state: string
): string {
  // Business Login 必要參數組合：
  // - config_id：指向我們建好的 Configuration
  // - response_type=code + override_default_response_type=true：強制走 code flow（預設是 token 隱式流）
  const params = new URLSearchParams({
    client_id: creds.app_id,
    config_id: creds.config_id,
    redirect_uri: creds.redirect_uri,
    response_type: 'code',
    override_default_response_type: 'true',
    state
  });
  return `https://www.facebook.com/${creds.api_version}/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForToken(
  creds: MetaCredentials,
  code: string
): Promise<ShortLivedTokenResponse> {
  const url = `https://graph.facebook.com/${creds.api_version}/oauth/access_token`;
  const { data } = await axios.get<ShortLivedTokenResponse>(url, {
    params: {
      client_id: creds.app_id,
      client_secret: creds.app_secret,
      redirect_uri: creds.redirect_uri,
      code
    }
  });
  return data;
}

async function exchangeForLongLived(
  creds: MetaCredentials,
  shortToken: string
): Promise<LongLivedTokenResponse> {
  const url = `https://graph.facebook.com/${creds.api_version}/oauth/access_token`;
  const { data } = await axios.get<LongLivedTokenResponse>(url, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: creds.app_id,
      client_secret: creds.app_secret,
      fb_exchange_token: shortToken
    }
  });
  return data;
}

async function fetchMe(
  creds: MetaCredentials,
  userToken: string
): Promise<MeResponse> {
  const url = `https://graph.facebook.com/${creds.api_version}/me`;
  const { data } = await axios.get<MeResponse>(url, {
    params: { access_token: userToken, fields: 'id,name' }
  });
  return data;
}

async function fetchPages(
  creds: MetaCredentials,
  userToken: string
): Promise<PageData[]> {
  const url = `https://graph.facebook.com/${creds.api_version}/me/accounts`;
  const { data } = await axios.get<{ data: PageData[] }>(url, {
    params: {
      access_token: userToken,
      fields:
        'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
    }
  });
  return data.data ?? [];
}

export interface MetaConnectResult {
  user: MeResponse;
  facebookAccounts: AccountPublic[];
  instagramAccounts: AccountPublic[];
}

export async function connectMetaAccount(): Promise<MetaConnectResult> {
  if (activeAuthWindow) {
    throw new Error('已有進行中的 Meta 授權流程，請完成或取消後再試');
  }

  const creds = loadCredentials();
  const state = randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(creds, state);
  console.log('[meta-oauth] opening dialog:', authUrl);

  // 取得 main window 作為 parent（讓 OAuth 視窗 modal 於 App 上方）
  const allWindows = BrowserWindow.getAllWindows();
  const parent = allWindows[0];

  const oauthWin = new BrowserWindow({
    parent,
    modal: true,
    width: 600,
    height: 760,
    title: 'PuffinPuff - Meta 授權',
    autoHideMenuBar: true,
    backgroundColor: '#FBF7F2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 不用 persistent partition，每次走全新 session 避免 cookie 殘留
      // DevTools 只在 dev 模式可用（packaged 版直接關掉，避免使用者看到嚇人介面）
      devTools: !app.isPackaged
    }
  });

  // 偽裝成普通 Chrome（去掉 Electron 標記），避免 Facebook 偵測 embedded webview 而拒絕
  oauthWin.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  // 只在 dev 模式自動開 DevTools；packaged 版不彈出
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
          reject(new Error(`Meta 授權拒絕：${errorDesc || errorParam}`));
          return;
        }
        if (returnedState !== state) {
          settled = true;
          reject(new Error('OAuth state 不一致（可能遭中間人攻擊），請重試'));
          return;
        }
        if (!returnedCode) {
          settled = true;
          reject(new Error('Meta 未回傳授權 code'));
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
      if (!settled) {
        settled = true;
        reject(new Error('使用者取消 Meta 授權'));
      }
      activeAuthWindow = null;
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        if (!oauthWin.isDestroyed()) oauthWin.close();
        reject(new Error('Meta OAuth 逾時（5 分鐘未完成授權）'));
      }
    }, 5 * 60 * 1000);

    oauthWin.loadURL(authUrl).catch((e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
  });

  // 1. 短期 token
  const shortLived = await exchangeCodeForToken(creds, code);
  // 2. 換長期 token（60 天）
  const longLived = await exchangeForLongLived(creds, shortLived.access_token);
  // 3. 取得使用者基本資料
  const me = await fetchMe(creds, longLived.access_token);

  // 3.5（v0.2.5）：把 user-level long-lived token 存進 meta_user_tokens 表，
  //   讓自動續期排程可以用這支 token 每 24h 檢查、< 7 天到期時自動 fb_exchange_token 換新。
  upsertMetaUserToken({
    fbUserId: me.id,
    fbUserName: me.name,
    accessToken: longLived.access_token,
    expiresInSec: longLived.expires_in
  });

  // 4. 取得粉專清單（含 IG Business 連動）
  const pages = await fetchPages(creds, longLived.access_token);

  const facebookAccounts: AccountPublic[] = [];
  const instagramAccounts: AccountPublic[] = [];

  for (const page of pages) {
    // FB 粉專本身
    const fbAccount = upsertAccount({
      platform: 'facebook',
      displayName: page.name,
      externalId: page.id,
      accessToken: page.access_token,
      refreshToken: null,
      expiresAt: null, // Page token from long-lived user token never expires
      metadata: {
        thumbnail: page.picture?.data.url ?? null,
        userName: me.name,
        userId: me.id
      }
    });
    facebookAccounts.push(fbAccount);

    // 如果該粉專有連動 IG Business，順便連 IG
    if (page.instagram_business_account) {
      const ig = page.instagram_business_account;
      const igAccount = upsertAccount({
        platform: 'instagram',
        displayName: ig.username ? `@${ig.username}` : (ig.name ?? '(未命名)'),
        externalId: ig.id,
        accessToken: page.access_token, // IG 透過 Page token 操作
        refreshToken: null,
        expiresAt: null,
        metadata: {
          thumbnail: ig.profile_picture_url ?? null,
          linkedPageId: page.id,
          linkedPageName: page.name,
          userName: me.name
        }
      });
      instagramAccounts.push(igAccount);
    }
  }

  return { user: me, facebookAccounts, instagramAccounts };
}

export function cancelMetaAuth(): void {
  if (activeAuthWindow && !activeAuthWindow.isDestroyed()) {
    activeAuthWindow.close();
  }
  activeAuthWindow = null;
}
