import { app, shell } from 'electron';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { upsertAccount, type AccountPublic } from '../lib/accountsRepo';

interface GoogleCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

let activeServer: Server | null = null;

function loadCredentials(): GoogleCredentials {
  const path = join(app.getAppPath(), 'secrets', 'google_oauth.json');
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as GoogleCredentials;
}

function htmlResponse(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>${title}</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#FBF7F2;color:#3F3A36;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#fff;padding:48px;border-radius:24px;box-shadow:0 8px 24px rgba(0,0,0,.08);text-align:center;max-width:480px}
    h1{margin:0 0 12px;font-size:24px}
    p{margin:0;color:#7C736B;line-height:1.6}
    .puffin{font-size:64px;margin-bottom:16px}
  </style></head><body><div class="card"><div class="puffin">🐧</div>${body}</div></body></html>`;
}

export interface GoogleConnectResult {
  account: AccountPublic;
}

export async function connectGoogleAccount(): Promise<GoogleConnectResult> {
  if (activeServer) {
    throw new Error('已有進行中的 Google 授權流程，請完成或取消後再試一次');
  }

  const creds = loadCredentials();

  return new Promise<GoogleConnectResult>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const port = (server.address() as AddressInfo).port;
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            htmlResponse('授權失敗', `<h1>授權失敗</h1><p>${error}</p><p>可以關閉此分頁回到 PuffinPuff。</p>`)
          );
          cleanup();
          reject(new Error(`Google OAuth 拒絕：${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400).end('missing code');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          htmlResponse(
            '授權完成',
            '<h1>授權完成 🎉</h1><p>海鸚已成功接到你的 YouTube 頻道。<br/>可以關閉此分頁回到 PuffinPuff。</p>'
          )
        );

        const oauth = new OAuth2Client({
          clientId: creds.installed.client_id,
          clientSecret: creds.installed.client_secret,
          redirectUri: `http://127.0.0.1:${port}/callback`
        });

        const { tokens } = await oauth.getToken({
          code,
          codeVerifier: codeVerifier ?? undefined
        });
        oauth.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth });
        const channelList = await youtube.channels.list({
          part: ['snippet'],
          mine: true
        });

        const channel = channelList.data.items?.[0];
        if (!channel || !channel.id || !channel.snippet) {
          cleanup();
          reject(new Error('找不到此 Google 帳號對應的 YouTube 頻道'));
          return;
        }

        const account = upsertAccount({
          platform: 'youtube',
          displayName: channel.snippet.title ?? '(未命名頻道)',
          externalId: channel.id,
          accessToken: tokens.access_token ?? '',
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: tokens.expiry_date ?? null,
          metadata: {
            thumbnail: channel.snippet.thumbnails?.default?.url ?? null,
            description: channel.snippet.description ?? ''
          }
        });

        cleanup();
        resolve({ account });
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    let codeVerifier: string | null = null;

    server.listen(0, '127.0.0.1', async () => {
      try {
        activeServer = server;
        const port = (server.address() as AddressInfo).port;
        const oauth = new OAuth2Client({
          clientId: creds.installed.client_id,
          clientSecret: creds.installed.client_secret,
          redirectUri: `http://127.0.0.1:${port}/callback`
        });

        const pkce = await oauth.generateCodeVerifierAsync();
        codeVerifier = pkce.codeVerifier;

        const authUrl = oauth.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPES,
          code_challenge_method: 'S256' as never,
          code_challenge: pkce.codeChallenge
        });

        console.log(`[google-oauth] listening on 127.0.0.1:${port}, opening browser…`);
        await shell.openExternal(authUrl);

        setTimeout(() => {
          if (activeServer === server) {
            cleanup();
            reject(new Error('Google OAuth 逾時（5 分鐘未完成授權）'));
          }
        }, 5 * 60 * 1000);
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    server.on('error', (e) => {
      cleanup();
      reject(e);
    });

    function cleanup(): void {
      if (activeServer === server) activeServer = null;
      try {
        server.close();
      } catch {
        /* noop */
      }
    }
  });
}

export function cancelGoogleAuth(): void {
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
}
