/**
 * v0.10.0：TikTok OAuth（Login Kit for Desktop）
 *
 * 官方規則（developers.tiktok.com/docs/en/login-kit-desktop）：
 *  - 桌面 app 的 redirect URI 可用 http://127.0.0.1:{port}/callback/（loopback + http 允許）
 *  - 必須使用 PKCE（S256）
 *  - redirect URI 要在 TikTok Developer Portal 的 Login Kit 設定中註冊
 *    → 本模組固定嘗試 6162 / 6163 / 6164 三個 port，三個 URI 都要註冊：
 *      http://127.0.0.1:6162/callback/
 *      http://127.0.0.1:6163/callback/
 *      http://127.0.0.1:6164/callback/
 *  - access token 約 24 小時，refresh token 365 天（adapter 端自動 refresh）
 */
import { shell } from 'electron';
import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import axios from 'axios';
import { upsertAccount, type AccountPublic } from '../lib/accountsRepo';
import { loadCredentialsJson } from '../lib/credentialsStore';

interface TikTokCredentials {
  client_key: string;
  client_secret: string;
  scopes?: string[];
}

const DEFAULT_SCOPES = ['user.info.basic', 'user.info.profile', 'video.publish'];
const CALLBACK_PORTS = [6162, 6163, 6164];

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL =
  'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username';

let activeServer: Server | null = null;
// v0.10.3：取消授權時立即 reject pending promise（原本只關 server，renderer 會懸著等 timeout）
let activeCancel: (() => void) | null = null;

function htmlResponse(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>${title}</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#FBF7F2;color:#3F3A36;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#fff;padding:48px;border-radius:24px;box-shadow:0 8px 24px rgba(0,0,0,.08);text-align:center;max-width:480px}
    h1{margin:0 0 12px;font-size:24px}
    p{margin:0;color:#7C736B;line-height:1.6}
    .puffin{font-size:64px;margin-bottom:16px}
  </style></head><body><div class="card"><div class="puffin">🐧</div>${body}</div></body></html>`;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 依序嘗試固定 port 清單，回傳第一個成功 listen 的 server + port */
function listenOnFirstFreePort(
  handler: Parameters<typeof createServer>[1]
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const tryPort = (idx: number): void => {
      if (idx >= CALLBACK_PORTS.length) {
        reject(
          new Error(
            `TikTok OAuth 的本機 port（${CALLBACK_PORTS.join(' / ')}）全被佔用，請關閉佔用程式後重試`
          )
        );
        return;
      }
      const port = CALLBACK_PORTS[idx];
      const server = createServer(handler);
      server.once('error', (e: NodeJS.ErrnoException) => {
        if (e.code === 'EADDRINUSE') {
          tryPort(idx + 1);
        } else {
          reject(e);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        resolve({ server, port });
      });
    };
    tryPort(0);
  });
}

export async function connectTikTokAccount(): Promise<AccountPublic> {
  if (activeServer) {
    throw new Error('已有進行中的 TikTok 授權流程，請完成或取消後再試一次');
  }

  const creds = loadCredentialsJson('tiktok') as TikTokCredentials;
  const scopes = creds.scopes?.length ? creds.scopes : DEFAULT_SCOPES;

  const codeVerifier = base64url(randomBytes(48));
  // ⚠ TikTok 的 PKCE 不照 RFC 7636：code_challenge 要 SHA256 的「hex」編碼，
  //   不是標準的 base64url（用標準版會報 invalid_request: Code verifier or code challenge is invalid）
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('hex');
  const stateToken = base64url(randomBytes(16));

  return new Promise<AccountPublic>((resolve, reject) => {
    let settled = false;
    let redirectUri = '';
    let serverRef: Server | null = null;

    function cleanup(): void {
      if (activeServer === serverRef) activeServer = null;
      activeCancel = null;
      try {
        serverRef?.close();
      } catch {
        /* noop */
      }
    }

    function fail(err: Error): void {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    function succeed(account: AccountPublic): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(account);
    }

    // v0.10.3：讓「取消授權」立即結束流程（而非等 5 分鐘 timeout）
    activeCancel = () => fail(new Error('已取消 TikTok 授權'));

    const handler = async (
      req: Parameters<NonNullable<Parameters<typeof createServer>[1]>>[0],
      res: Parameters<NonNullable<Parameters<typeof createServer>[1]>>[1]
    ): Promise<void> => {
      try {
        const url = new URL(req.url ?? '/', redirectUri);
        if (url.pathname !== '/callback/' && url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }

        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            htmlResponse(
              '授權失敗',
              `<h1>授權失敗</h1><p>${error}</p><p>可以關閉此分頁回到 PuffinPuff。</p>`
            )
          );
          fail(new Error(`TikTok OAuth 拒絕：${error}`));
          return;
        }
        if (!code) {
          res.writeHead(400).end('missing code');
          return;
        }
        if (state !== stateToken) {
          res.writeHead(400).end('state mismatch');
          fail(new Error('TikTok OAuth state 不符（可能是過期的授權分頁），請重試'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          htmlResponse(
            '授權完成',
            '<h1>授權完成 🎉</h1><p>海鸚已成功接到你的 TikTok 帳號。<br/>可以關閉此分頁回到 PuffinPuff。</p>'
          )
        );

        // 換 token（x-www-form-urlencoded + code_verifier）
        const tokenResp = await axios.post(
          TOKEN_URL,
          new URLSearchParams({
            client_key: creds.client_key,
            client_secret: creds.client_secret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const tk = tokenResp.data as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          refresh_expires_in?: number;
          open_id?: string;
          scope?: string;
          error?: string;
          error_description?: string;
        };
        if (!tk.access_token || !tk.open_id) {
          fail(
            new Error(
              `TikTok token 交換失敗：${tk.error ?? ''} ${tk.error_description ?? JSON.stringify(tk).slice(0, 200)}`
            )
          );
          return;
        }

        // 抓用戶資料（display_name / username / avatar）
        let displayName = 'TikTok 帳號';
        let username: string | null = null;
        let avatar: string | null = null;
        try {
          const infoResp = await axios.get(USER_INFO_URL, {
            headers: { Authorization: `Bearer ${tk.access_token}` }
          });
          const user = (infoResp.data?.data?.user ?? {}) as {
            display_name?: string;
            username?: string;
            avatar_url?: string;
          };
          displayName = user.display_name || displayName;
          username = user.username ?? null;
          avatar = user.avatar_url ?? null;
        } catch (e) {
          console.warn('[tiktok-oauth] user info fetch failed:', (e as Error).message);
        }

        const account = upsertAccount({
          platform: 'tiktok',
          displayName,
          externalId: tk.open_id,
          accessToken: tk.access_token,
          refreshToken: tk.refresh_token ?? null,
          expiresAt: tk.expires_in ? Date.now() + tk.expires_in * 1000 : null,
          metadata: {
            thumbnail: avatar,
            username,
            scope: tk.scope ?? scopes.join(','),
            refreshExpiresAt: tk.refresh_expires_in
              ? Date.now() + tk.refresh_expires_in * 1000
              : null
          }
        });

        console.log(`[tiktok-oauth] connected: ${displayName} (${tk.open_id})`);
        succeed(account);
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    };

    listenOnFirstFreePort(handler)
      .then(async ({ server, port }) => {
        serverRef = server;
        activeServer = server;
        redirectUri = `http://127.0.0.1:${port}/callback/`;

        const authUrl =
          `${AUTH_URL}?` +
          new URLSearchParams({
            client_key: creds.client_key,
            scope: scopes.join(','),
            response_type: 'code',
            redirect_uri: redirectUri,
            state: stateToken,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
          }).toString();

        console.log(`[tiktok-oauth] listening on 127.0.0.1:${port}, opening browser…`);
        await shell.openExternal(authUrl);

        setTimeout(() => {
          fail(new Error('TikTok OAuth 逾時（5 分鐘未完成授權）'));
        }, 5 * 60 * 1000);
      })
      .catch((e) => fail(e instanceof Error ? e : new Error(String(e))));
  });
}

export function cancelTikTokAuth(): void {
  if (activeCancel) {
    activeCancel(); // v0.10.3：立即 reject pending promise + 清理 server
    return;
  }
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
}
