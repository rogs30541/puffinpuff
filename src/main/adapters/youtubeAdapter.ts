import { statSync, createReadStream } from 'node:fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  getAccountById,
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  upsertAccount
} from '../lib/accountsRepo';
import { loadCredentialsJson } from '../lib/credentialsStore';

interface GoogleCredentials {
  installed: {
    client_id: string;
    client_secret: string;
  };
}

function loadCredentials(): GoogleCredentials {
  // v0.9.0：走中央憑證層（DB 優先 → secrets 檔案 fallback）
  return loadCredentialsJson('google') as GoogleCredentials;
}

function buildOAuthClient(accountId: number): OAuth2Client {
  const account = getAccountById(accountId);
  if (!account) throw new Error(`找不到 YouTube 帳號 id=${accountId}`);

  const accessToken = getDecryptedAccessToken(accountId);
  const refreshToken = getDecryptedRefreshToken(accountId);
  if (!accessToken && !refreshToken) {
    throw new Error('帳號未授權，請重新連線');
  }

  const creds = loadCredentials();
  const client = new OAuth2Client({
    clientId: creds.installed.client_id,
    clientSecret: creds.installed.client_secret
  });

  client.setCredentials({
    access_token: accessToken ?? undefined,
    refresh_token: refreshToken ?? undefined,
    expiry_date: account.expiresAt ?? undefined
  });

  // 當 token 自動刷新時，把新值寫回資料庫
  client.on('tokens', (tokens) => {
    try {
      const freshAccess = tokens.access_token ?? accessToken ?? '';
      const freshRefresh = tokens.refresh_token ?? refreshToken ?? undefined;
      upsertAccount({
        platform: 'youtube',
        displayName: account.displayName,
        externalId: account.externalId,
        accessToken: freshAccess,
        refreshToken: freshRefresh ?? null,
        expiresAt: tokens.expiry_date ?? null,
        metadata: account.metadata
      });
      console.log(`[youtube] refreshed token for account ${accountId}`);
    } catch (e) {
      console.error('[youtube] persist refreshed token failed:', e);
    }
  });

  return client;
}

export interface YouTubeUploadArgs {
  accountId: number;
  filePath: string;
  title: string;
  description: string;
  hashtags: string;
  privacy: 'public' | 'private' | 'unlisted';
}

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  privacyStatus: string;
}

export interface UploadProgressEvent {
  bytesUploaded: number;
  totalBytes: number;
  percent: number;
}

function buildDescription(description: string, hashtags: string): string {
  const lines: string[] = [];
  if (description.trim()) lines.push(description.trim());
  if (hashtags.trim()) lines.push('', hashtags.trim());
  return lines.join('\n');
}

function extractTags(hashtags: string): string[] {
  return hashtags
    .split(/\s+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 15); // YouTube 標籤上限約 500 字元；保守取前 15 個
}

export async function uploadToYouTube(
  args: YouTubeUploadArgs,
  onProgress?: (e: UploadProgressEvent) => void
): Promise<YouTubeUploadResult> {
  const oauth = buildOAuthClient(args.accountId);
  const youtube = google.youtube({ version: 'v3', auth: oauth });

  const stat = statSync(args.filePath);
  const totalBytes = stat.size;

  const description = buildDescription(args.description, args.hashtags);
  const tags = extractTags(args.hashtags);

  // 在 description 末尾加 #Shorts 確保被識別為 Shorts（只有當原本有描述時才加）
  const finalDescription =
    description.trim().length === 0
      ? ''
      : /#shorts/i.test(description)
        ? description
        : description + '\n#Shorts';

  console.log(`[youtube] uploading ${args.filePath} (${totalBytes} bytes)`);

  const response = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: args.title.slice(0, 100),
          description: finalDescription.slice(0, 5000),
          tags,
          categoryId: '22' // People & Blogs（安全預設）
        },
        status: {
          privacyStatus: args.privacy,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: createReadStream(args.filePath)
      }
    },
    {
      // googleapis 透過 gaxios，這裡可以拿到上傳進度
      onUploadProgress: (e: { bytesRead?: number }) => {
        const bytesUploaded = e.bytesRead ?? 0;
        const percent = totalBytes > 0 ? Math.min(100, (bytesUploaded / totalBytes) * 100) : 0;
        onProgress?.({ bytesUploaded, totalBytes, percent });
      }
    }
  );

  const data = response.data;
  if (!data.id) {
    throw new Error('YouTube 回應中沒有 video id');
  }

  return {
    videoId: data.id,
    url: `https://youtube.com/shorts/${data.id}`,
    privacyStatus: data.status?.privacyStatus ?? args.privacy
  };
}
