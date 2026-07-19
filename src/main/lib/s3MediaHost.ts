/**
 * v0.8.0：S3 相容物件儲存媒體通道
 *
 * 原理：把本機檔案上傳到使用者自己的 S3 相容 bucket（R2 / S3 / B2 / MinIO），
 * 產生 Meta 可抓取的公開 URL，發布完成後刪除物件。
 *
 * 對比 tunnel 方案的優勢：
 *  - 沒有本機 port → 不會有 port 佔用問題
 *  - 沒有 cloudflared 進程 → 沒有 spawn/kill/CLI bug
 *  - 無限並發（每次上傳都是獨立 object key）
 *  - URL 穩定，Meta 抓取成功率高
 *
 * URL 模式：
 *  - public_base_url 有值 → `${publicBaseUrl}/${key}`（公開 bucket / R2.dev / 自訂網域）
 *  - public_base_url 空 → presigned GET URL（1 小時失效，bucket 可保持 private，較安全）
 */
import { readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3ConfigInternal, type S3ConfigInternal } from './s3ConfigRepo';

/** presigned URL 有效時間（Meta 抓檔 + container 處理綽綽有餘） */
const PRESIGN_EXPIRES_SEC = 3600;

function contentTypeForName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function makeClient(config: S3ConfigInternal): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    // MinIO / 部分 S3 相容服務需要 path-style；R2 兩種都支援
    forcePathStyle: true
  });
}

export interface S3HostedFile {
  url: string;
  close: () => Promise<void>;
}

export async function hostFileViaS3(opts: {
  filePath: string;
  exposedName?: string;
  onStatus?: (msg: string) => void;
}): Promise<S3HostedFile> {
  const { filePath, exposedName = 'video.mp4', onStatus } = opts;
  const config = getS3ConfigInternal();
  if (!config) {
    throw new Error(
      '媒體通道設為「雲端物件儲存」但找不到設定。\n' +
      '請至「設定 → 媒體發布通道」填入 Endpoint / Bucket / Access Key，或切回 tunnel 模式。'
    );
  }

  const client = makeClient(config);
  const fileSize = statSync(filePath).size;
  const key = `puffinpuff/${Date.now().toString(36)}-${randomBytes(4).toString('hex')}/${exposedName}`;
  const contentType = contentTypeForName(exposedName);

  onStatus?.(`上傳到物件儲存（${(fileSize / (1024 * 1024)).toFixed(1)} MB）...`);
  console.log(`[s3-host] uploading ${filePath} → s3://${config.bucket}/${key}`);

  const body = readFileSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: fileSize
    })
  );

  let url: string;
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/+$/, '');
    url = `${base}/${key}`;
  } else {
    url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: PRESIGN_EXPIRES_SEC }
    );
  }
  console.log(`[s3-host] hosted at ${url.split('?')[0]}${config.publicBaseUrl ? '' : ' (presigned)'}`);
  onStatus?.('物件儲存上傳完成');

  return {
    url,
    close: async () => {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
        console.log(`[s3-host] deleted s3://${config.bucket}/${key}`);
      } catch (e) {
        // 刪除失敗不致命 — 使用者可自行清 bucket（或設 bucket lifecycle rule）
        console.warn('[s3-host] delete object failed:', (e as Error).message);
      } finally {
        client.destroy();
      }
    }
  };
}

/**
 * 「測試連線」：上傳一個 1KB 測試檔 → 產 URL → HTTP GET 驗證可讀 → 刪除。
 * 完整驗證整條鏈（credentials、bucket 權限、公開 URL 配置）。
 */
export async function testS3Connection(input: {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const config: S3ConfigInternal = {
    endpoint: input.endpoint.trim(),
    bucket: input.bucket.trim(),
    region: input.region?.trim() || 'auto',
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    publicBaseUrl: input.publicBaseUrl?.trim() || null
  };
  const client = makeClient(config);
  const testKey = `puffinpuff/connection-test-${Date.now()}.txt`;

  try {
    // 1. bucket 存在 + 有權限
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));

    // 2. 能寫
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: testKey,
        Body: Buffer.from('PuffinPuff connection test'),
        ContentType: 'text/plain'
      })
    );

    // 3. URL 可讀（模擬 Meta 來抓）
    let testUrl: string;
    if (config.publicBaseUrl) {
      testUrl = `${config.publicBaseUrl.replace(/\/+$/, '')}/${testKey}`;
    } else {
      testUrl = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: testKey }),
        { expiresIn: 300 }
      );
    }
    const resp = await fetch(testUrl, { method: 'GET' });
    if (!resp.ok) {
      return {
        ok: false,
        message:
          `上傳成功但 URL 無法讀取（HTTP ${resp.status}）。\n` +
          (config.publicBaseUrl
            ? `公開 URL 前綴可能不對（${config.publicBaseUrl}），或 bucket 未開公開讀取。\n提示：R2 的話請確認已啟用 r2.dev 公開域名或綁定自訂網域；也可以清空「公開 URL 前綴」改用 presigned 模式。`
            : `presigned URL 被拒 — 檢查 keys 權限是否含 GetObject。`)
      };
    }

    // 4. 清掉測試檔
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: testKey }));

    return {
      ok: true,
      message: `連線正常 ✓ 寫入 / 讀取 / 刪除 都通過（${config.publicBaseUrl ? '公開 URL 模式' : 'presigned URL 模式'}）`
    };
  } catch (e) {
    const err = e as Error & { $metadata?: { httpStatusCode?: number }; name?: string };
    let hint = '';
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      hint = `\nBucket「${config.bucket}」不存在 — 請先到儲存服務後台建立。`;
    } else if (err.$metadata?.httpStatusCode === 403) {
      hint = '\nAccess Key 沒有此 bucket 的權限（403）— 檢查 API token 的 bucket 範圍與讀寫權限。';
    } else if (/getaddrinfo|ENOTFOUND|ECONNREFUSED/.test(err.message)) {
      hint = `\nEndpoint 無法連線（${config.endpoint}）— 檢查網址是否正確。`;
    }
    return { ok: false, message: `S3 連線測試失敗：${err.message}${hint}` };
  } finally {
    try {
      client.destroy();
    } catch {
      /* noop */
    }
  }
}
