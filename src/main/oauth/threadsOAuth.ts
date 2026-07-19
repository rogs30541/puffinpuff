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
import { BrowserWindow, session } from 'electron';
import { randomBytes } from 'node:crypto';
import axios from 'axios';
import { upsertAccount, type AccountPublic } from '../lib/accountsRepo';
import { loadCredentialsJson } from '../lib/credentialsStore';

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
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('threads') as ThreadsCredentials;
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

  console.log('[threads-oauth] ============================================');
  console.log('[threads-oauth] === 開始 Threads OAuth 流程 v0.7.1 診斷版 ===');
  console.log('[threads-oauth] ============================================');
  console.log('[threads-oauth] app_id:        ', creds.app_id);
  console.log('[threads-oauth] redirect_uri:  ', creds.redirect_uri);
  console.log('[threads-oauth] scopes:        ', creds.scopes.join(','));
  console.log('[threads-oauth] state:         ', state);
  console.log('[threads-oauth] 完整 auth URL:');
  console.log('[threads-oauth]   ' + authUrl);
  console.log('[threads-oauth] ============================================');

  // v0.7.1：用獨立 session partition，避免 Threads 既有 cookie 干擾 OAuth flow
  const partition = `persist:threads-oauth-${Date.now()}`;
  const oauthSession = session.fromPartition(partition);
  await oauthSession.clearStorageData({ storages: ['cookies'] }).catch(() => {});

  const parent = BrowserWindow.getAllWindows()[0];
  const oauthWin = new BrowserWindow({
    parent,
    modal: true,
    width: 700,
    height: 820,
    title: 'PuffinPuff - Threads 授權（v0.7.1 診斷版）',
    autoHideMenuBar: true,
    backgroundColor: '#FBF7F2',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      session: oauthSession
    }
  });

  oauthWin.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  // v0.7.1：永遠開 DevTools（packaged build 也開）方便診斷
  oauthWin.webContents.openDevTools({ mode: 'detach' });
  activeAuthWindow = oauthWin;

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let stuckOnHomeChecker: NodeJS.Timeout | null = null;

    function logNav(eventName: string, url: string): void {
      console.log(`[threads-oauth][${eventName}] ${url}`);
    }

    function handleNavigation(url: string, source: string, eventLike?: Electron.Event): void {
      if (settled) return;
      logNav(source, url);

      // v0.7.1：偵測「卡在 threads.net 非 /oauth 頁面」— 5 秒後提示
      try {
        const u = new URL(url);
        const isThreadsHost = u.host.endsWith('threads.net');
        const isOAuthPath = u.pathname.startsWith('/oauth') || u.pathname.startsWith('/privacy') || u.pathname.startsWith('/consent');
        const isRedirect = url.startsWith(creds.redirect_uri);
        if (isThreadsHost && !isOAuthPath && !isRedirect) {
          if (stuckOnHomeChecker) clearTimeout(stuckOnHomeChecker);
          stuckOnHomeChecker = setTimeout(() => {
            if (!settled) {
              console.warn('[threads-oauth] ⚠⚠⚠ 視窗停在 threads.net 非 /oauth 頁面超過 5 秒 ⚠⚠⚠');
              console.warn('[threads-oauth] 當前 URL:', url);
              console.warn('[threads-oauth] === Threads 拒絕了授權請求，可能原因：===');
              console.warn('[threads-oauth] 1. Threads App ID 不對：', creds.app_id);
              console.warn('[threads-oauth] 2. Redirect URI 在 Meta Dashboard 未設定或不完全一致：', creds.redirect_uri);
              console.warn('[threads-oauth] 3. 登入的 Threads 帳號未加成 Tester / 未接受邀請');
              console.warn('[threads-oauth] 4. App 還在 Threads 後台 propagation（剛設好時可能要等 30 分鐘 ~ 數小時）');
              console.warn('[threads-oauth] === 請打開 OAuth 視窗的 DevTools → Network 看實際的 redirect chain ===');
            }
          }, 5_000);
        }
      } catch {
        // URL parse 失敗忽略
      }

      if (!url.startsWith(creds.redirect_uri)) return;

      eventLike?.preventDefault();
      try {
        const parsed = new URL(url);
        const returnedCode = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        const errorParam = parsed.searchParams.get('error');
        const errorDesc = parsed.searchParams.get('error_description');

        console.log('[threads-oauth] === 收到 callback ===');
        console.log('[threads-oauth] code:           ', returnedCode ? returnedCode.slice(0, 20) + '...' : '(無)');
        console.log('[threads-oauth] state:          ', returnedState);
        console.log('[threads-oauth] state 是否相符: ', returnedState === state);
        console.log('[threads-oauth] error:          ', errorParam ?? '(無)');
        console.log('[threads-oauth] error_desc:     ', errorDesc ?? '(無)');

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
        if (stuckOnHomeChecker) clearTimeout(stuckOnHomeChecker);
        if (!oauthWin.isDestroyed()) oauthWin.close();
      }
    }

    // v0.7.1：監聽所有 navigation 事件，涵蓋 server redirect / link click / programmatic nav
    oauthWin.webContents.on('will-redirect', (event, url) => handleNavigation(url, 'will-redirect', event));
    oauthWin.webContents.on('will-navigate', (event, url) => handleNavigation(url, 'will-navigate', event));
    oauthWin.webContents.on('did-navigate', (_event, url) => handleNavigation(url, 'did-navigate'));
    oauthWin.webContents.on('did-redirect-navigation', (_event, url) => handleNavigation(url, 'did-redirect-navigation'));
    oauthWin.webContents.on('did-navigate-in-page', (_event, url) => handleNavigation(url, 'did-navigate-in-page'));

    // v0.7.1：redirect 到 https://localhost/... 會 did-fail-load — 從這裡截 callback
    oauthWin.webContents.on('did-fail-load', (_event, errorCode, errorDesc, validatedURL) => {
      console.log(`[threads-oauth][did-fail-load] code=${errorCode} desc=${errorDesc} url=${validatedURL}`);
      if (!settled && validatedURL.startsWith(creds.redirect_uri)) {
        handleNavigation(validatedURL, 'did-fail-load-as-callback');
      }
    });

    oauthWin.on('closed', () => {
      if (stuckOnHomeChecker) clearTimeout(stuckOnHomeChecker);
      activeAuthWindow = null;
      if (!settled) {
        settled = true;
        reject(new Error('使用者關閉授權視窗（若視窗卡在 threads.net 首頁 = Threads 拒絕了授權請求，請看 main process console 找原因）'));
      }
    });

    oauthWin.loadURL(authUrl).catch((e) => {
      console.error('[threads-oauth] loadURL 失敗:', e);
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
