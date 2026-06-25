import { app, net } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  unlinkSync
} from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { getTunnelMode } from './settingsRepo';
import { getTunnelConfigInternal } from './tunnelConfigRepo';

// v0.5.0：named tunnel mode 使用固定 port（與 Cloudflare dashboard ingress 設定對應）
export const NAMED_TUNNEL_LOCAL_PORT = 33344;

// v0.6.0：依檔名副檔名選 Content-Type，避免圖檔被當 video/mp4 送出去
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

// Cloudflare 官方 cloudflared 二進位
const CLOUDFLARED_URLS: Record<string, string> = {
  win32:
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  darwin:
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
  linux:
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64'
};

function cloudflaredPath(): string {
  const isWin = process.platform === 'win32';
  return join(app.getPath('userData'), 'bin', isWin ? 'cloudflared.exe' : 'cloudflared');
}

async function downloadCloudflared(onStatus?: (msg: string) => void): Promise<string> {
  const path = cloudflaredPath();
  const downloadUrl = CLOUDFLARED_URLS[process.platform];
  if (!downloadUrl) {
    throw new Error(`不支援的平台：${process.platform}`);
  }

  mkdirSync(join(path, '..'), { recursive: true });
  onStatus?.('正在下載 cloudflared 隧道工具（~30MB）...');
  console.log('[tunnel] downloading cloudflared from', downloadUrl);

  const resp = await net.fetch(downloadUrl, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`下載 cloudflared 失敗：HTTP ${resp.status}`);
  }
  const ab = await resp.arrayBuffer();
  writeFileSync(path, Buffer.from(ab));
  console.log('[tunnel] cloudflared saved to', path, 'size=', Buffer.from(ab).length);
  onStatus?.('cloudflared 已就緒');
  return path;
}

async function ensureCloudflared(
  onStatus?: (msg: string) => void
): Promise<string> {
  const path = cloudflaredPath();
  if (existsSync(path) && statSync(path).size > 1_000_000) {
    return path;
  }
  return await downloadCloudflared(onStatus);
}

/**
 * v0.4.6：強制重新下載 cloudflared（給 Settings 手動按鈕用）
 */
export async function redownloadCloudflared(
  onStatus?: (msg: string) => void
): Promise<{ path: string; bytes: number }> {
  const path = cloudflaredPath();
  if (existsSync(path)) {
    try {
      unlinkSync(path);
      console.log('[tunnel] removed old cloudflared at', path);
    } catch (e) {
      console.warn('[tunnel] failed to remove old cloudflared:', (e as Error).message);
    }
  }
  const newPath = await downloadCloudflared(onStatus);
  const bytes = statSync(newPath).size;
  return { path: newPath, bytes };
}

export interface TunneledFile {
  /** 公開可用的 HTTPS URL，IG bot 可以從這裡抓影片 */
  url: string;
  /** 中止 server 與 cloudflared process */
  close: () => Promise<void>;
}

interface ServeOptions {
  filePath: string;
  /** 給檔案在 URL 上的「假檔名」，例 `video.mp4` */
  exposedName?: string;
  /** 階段訊息回呼（讓 UI 可以顯示「下載 cloudflared 中…」之類） */
  onStatus?: (msg: string) => void;
}

interface TunnelAttemptResult {
  publicUrl: string;
  proc: ChildProcess;
}

/**
 * v0.4.7：失敗的 attempt 會丟 TunnelAttemptError，帶有 stderr 原文 + 錯誤分類。
 */
type TunnelErrorKind = 'rate_limit' | 'unknown';

class TunnelAttemptError extends Error {
  constructor(
    public readonly kind: TunnelErrorKind,
    message: string,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'TunnelAttemptError';
  }
}

/**
 * v0.4.7：判斷 cloudflared 失敗類型。
 * - rate_limit：Cloudflare 對「無帳號 quick tunnel」做 IP rate limit（1015 / 429）
 *   → 重下載 binary 沒用，要等或換 IP
 * - unknown：其他原因，可能是 binary 損壞 → 重下載一次再試
 */
function classifyTunnelError(stderr: string): TunnelErrorKind {
  // Cloudflare 端 rate limit 的標準訊號
  if (/1015/.test(stderr)) return 'rate_limit';
  if (/429\s*Too Many Requests/i.test(stderr)) return 'rate_limit';
  if (/Too Many Requests/i.test(stderr) && /QuickTunnel/i.test(stderr)) return 'rate_limit';
  return 'unknown';
}

/** v0.4.6：拆出來的單次嘗試流程，失敗會丟出帶有 stderr 細節的 error。*/
async function attemptTunnel(
  bin: string,
  port: number,
  onStatus?: (msg: string) => void
): Promise<TunnelAttemptResult> {
  onStatus?.('啟動 cloudflared tunnel...');
  const proc: ChildProcess = spawn(
    bin,
    ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let publicUrl: string | null = null;
  // v0.4.6：完整收集 stdout/stderr，失敗時可以 surface 給使用者
  const stderrChunks: string[] = [];
  const stdoutChunks: string[] = [];
  const MAX_LOG_BYTES = 8_000;

  const onStdout = (chunk: Buffer): void => {
    const text = chunk.toString('utf-8');
    stdoutChunks.push(text);
    if (!publicUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        publicUrl = match[0];
        console.log(`[tunnel] public URL: ${publicUrl}`);
      }
    }
  };
  const onStderr = (chunk: Buffer): void => {
    const text = chunk.toString('utf-8');
    stderrChunks.push(text);
    // cloudflared 把正常訊息也寫到 stderr，URL 也常在這
    if (!publicUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        publicUrl = match[0];
        console.log(`[tunnel] public URL: ${publicUrl}`);
      }
    }
  };

  proc.stdout?.on('data', onStdout);
  proc.stderr?.on('data', onStderr);

  const buildDiagnostic = (prefix: string): { message: string; stderr: string } => {
    const stderr = stderrChunks.join('').trim();
    const stdout = stdoutChunks.join('').trim();
    let detail = '';
    if (stderr) {
      const tail = stderr.length > MAX_LOG_BYTES ? '…' + stderr.slice(-MAX_LOG_BYTES) : stderr;
      detail += `\n[stderr]\n${tail}`;
    }
    if (stdout) {
      const tail = stdout.length > MAX_LOG_BYTES ? '…' + stdout.slice(-MAX_LOG_BYTES) : stdout;
      detail += `\n[stdout]\n${tail}`;
    }
    if (!detail) detail = '\n（無輸出）';
    return { message: `${prefix}${detail}`, stderr };
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        if (publicUrl) {
          clearInterval(timer);
          clearTimeout(timeout);
          resolve();
        }
      }, 200);
      const timeout = setTimeout(() => {
        clearInterval(timer);
        const d = buildDiagnostic('cloudflared tunnel 啟動逾時（30 秒）');
        reject(new TunnelAttemptError(classifyTunnelError(d.stderr), d.message, d.stderr));
      }, 30_000);
      proc.on('error', (e) => {
        clearInterval(timer);
        clearTimeout(timeout);
        const d = buildDiagnostic(`cloudflared spawn 失敗：${e.message}`);
        reject(new TunnelAttemptError(classifyTunnelError(d.stderr), d.message, d.stderr));
      });
      proc.on('exit', (code, signal) => {
        if (!publicUrl) {
          clearInterval(timer);
          clearTimeout(timeout);
          const tag = signal ? `signal=${signal}` : `exit code ${code}`;
          const d = buildDiagnostic(`cloudflared 異常結束（${tag}）`);
          reject(new TunnelAttemptError(classifyTunnelError(d.stderr), d.message, d.stderr));
        }
      });
    });
    return { publicUrl: publicUrl as unknown as string, proc };
  } catch (e) {
    // 確保 proc 收掉
    try {
      proc.kill();
    } catch {
      /* noop */
    }
    throw e;
  }
}

/**
 * 啟動本機 HTTP server 提供單一影片檔案，並用 cloudflared quick tunnel 暴露成公開 HTTPS URL。
 *
 * v0.4.6：首次失敗 → 自動重下載 cloudflared 後再試一次。
 *
 * 使用方式：
 * ```
 * const t = await serveFileViaCloudflareTunnel({ filePath });
 * try {
 *   // 把 t.url 傳給需要公開 URL 的 API（如 IG）
 *   await callApi(t.url);
 * } finally {
 *   await t.close();
 * }
 * ```
 */
export async function serveFileViaCloudflareTunnel(
  opts: ServeOptions
): Promise<TunneledFile> {
  // v0.5.0：根據設定模式分派
  const mode = getTunnelMode();
  if (mode === 'named-cloudflare') {
    return await serveViaNamedCloudflareTunnel(opts);
  }
  return await serveViaQuickCloudflareTunnel(opts);
}

async function serveViaQuickCloudflareTunnel(
  opts: ServeOptions
): Promise<TunneledFile> {
  const { filePath, exposedName = 'video.mp4', onStatus } = opts;

  // 1. 啟動本機 HTTP server
  const fileSize = statSync(filePath).size;
  const fileBuffer = readFileSync(filePath); // V1：125MB 級檔案讀進 RAM 還能接受
  // v0.6.0：依 exposedName 副檔名挑 Content-Type，圖檔別硬塞 video/mp4
  const contentType = contentTypeForName(exposedName);
  const server: Server = createServer((req, res) => {
    if (!req.url || !req.url.startsWith('/' + exposedName)) {
      res.writeHead(404).end();
      return;
    }
    // v0.6.0：支援 HEAD（Meta fetch 前常會 HEAD 預檢 metadata）
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      res.end();
      return;
    }
    // 支援 Range 請求（IG/FB 拉檔常用）
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(fileBuffer.subarray(start, end + 1));
        return;
      }
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(fileBuffer);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  console.log(`[tunnel] local HTTP server on 127.0.0.1:${port}`);

  // 2. 取得 cloudflared 並啟動
  //    v0.4.7：根據錯誤類型挑恢復策略 —
  //    - rate_limit（Cloudflare 對 IP 限流）→ 指數退避等待 + retry，不重下載 binary
  //    - unknown → 重下載 binary + retry 一次
  let bin = await ensureCloudflared(onStatus);
  let attempt: TunnelAttemptResult;
  const closeServerAndThrow = async (err: Error): Promise<never> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw err;
  };

  try {
    attempt = await attemptTunnel(bin, port, onStatus);
  } catch (firstErrUnknown) {
    const firstErr = firstErrUnknown as TunnelAttemptError;
    console.warn('[tunnel] first attempt failed:', firstErr.kind, firstErr.message);

    if (firstErr.kind === 'rate_limit') {
      // v0.4.7：Cloudflare quick tunnel rate limit（error 1015 / 429）
      // 退避 60s → 再失敗就退避 120s，最多 2 次重試（總等待 ≤ 180s）
      const backoffMs = [60_000, 120_000];
      let success = false;
      let lastErr: TunnelAttemptError = firstErr;
      for (let i = 0; i < backoffMs.length; i++) {
        const wait = backoffMs[i];
        onStatus?.(
          `Cloudflare quick tunnel 對你的 IP 限流中（error 1015），等 ${Math.round(wait / 1000)} 秒後重試（${i + 1}/${backoffMs.length}）...`
        );
        await new Promise((r) => setTimeout(r, wait));
        try {
          attempt = await attemptTunnel(bin, port, onStatus);
          success = true;
          break;
        } catch (retryErr) {
          lastErr = retryErr as TunnelAttemptError;
          console.warn(`[tunnel] retry ${i + 1} failed:`, lastErr.kind, lastErr.message);
          if (lastErr.kind !== 'rate_limit') {
            // 退避中變成別的錯誤 → 跳出進入 unknown 分支
            break;
          }
        }
      }
      if (!success) {
        if (lastErr.kind === 'rate_limit') {
          await closeServerAndThrow(
            new Error(
              [
                'Cloudflare quick tunnel 對你的 IP 限流中（error 1015 / 429 Too Many Requests），重試 2 次仍然失敗。',
                '',
                '【解決方法】請擇一：',
                '  1. 等 30-60 分鐘讓 Cloudflare 自動解除限流',
                '  2. 切換網路（手機熱點）讓出口 IP 改變',
                '  3. 開啟 VPN 換出口 IP',
                '  4. （未來 v0.5.0）改用 Cloudflare named tunnel，無 IP 限流',
                '',
                '原始錯誤訊息：',
                lastErr.message
              ].join('\n')
            )
          );
        }
        // rate_limit 退避中變成 unknown error → 進入下方 fallthrough
      }
      // success 為 true 時，attempt 已賦值，跳到後面
      if (!success) {
        // fallthrough：把 lastErr 當作 firstErr 重新走 unknown 路徑
        await tryRedownloadAndRetry();
      }
    } else {
      // unknown 錯誤 → 重下載 binary + retry
      await tryRedownloadAndRetry();
    }

    async function tryRedownloadAndRetry(): Promise<void> {
      onStatus?.('cloudflared 啟動失敗，重新下載最新版後再試...');
      try {
        const fresh = await redownloadCloudflared(onStatus);
        bin = fresh.path;
      } catch (dlErr) {
        await closeServerAndThrow(
          new Error(
            `${firstErr.message}\n\n重新下載 cloudflared 也失敗：${(dlErr as Error).message}`
          )
        );
      }
      try {
        attempt = await attemptTunnel(bin, port, onStatus);
      } catch (secondErrUnknown) {
        const secondErr = secondErrUnknown as TunnelAttemptError;
        if (secondErr.kind === 'rate_limit') {
          await closeServerAndThrow(
            new Error(
              [
                'cloudflared 重下載後仍失敗，原因是 Cloudflare quick tunnel 對你的 IP 限流（1015 / 429）。',
                '請等 30-60 分鐘或換網路 / VPN 後重試。',
                '',
                '原始錯誤訊息：',
                secondErr.message
              ].join('\n')
            )
          );
        }
        await closeServerAndThrow(
          new Error(`cloudflared 重新下載後仍無法啟動：\n\n${secondErr.message}`)
        );
      }
    }
  }

  const { publicUrl, proc } = attempt!;

  return {
    url: `${publicUrl}/${exposedName}`,
    close: async () => {
      try {
        proc.kill();
      } catch {
        /* noop */
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
      console.log('[tunnel] closed');
    }
  };
}

// =============================================================================
// v0.5.0：Named tunnel 實作
// =============================================================================

/**
 * 共用：建立本機 HTTP server 提供單一檔案（支援 Range 請求）
 *
 * @param port - 0 表示隨機 port；其他值表示固定 port（named tunnel mode 用）
 */
function createLocalFileServerOnce(args: {
  filePath: string;
  exposedName: string;
  port: number;
}): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const { filePath, exposedName, port } = args;
    const fileSize = statSync(filePath).size;
    const fileBuffer = readFileSync(filePath);
    // v0.6.0：依副檔名挑 Content-Type
    const contentType = contentTypeForName(exposedName);

    const server: Server = createServer((req, res) => {
      if (!req.url || !req.url.startsWith('/' + exposedName)) {
        res.writeHead(404).end();
        return;
      }
      // v0.6.0：支援 HEAD
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(fileBuffer.subarray(start, end + 1));
          return;
        }
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(fileBuffer);
    });

    server.on('error', (e: NodeJS.ErrnoException) => {
      reject(e);
    });

    server.listen(port, '127.0.0.1', () => {
      const actualPort = (server.address() as AddressInfo).port;
      console.log(`[tunnel] local HTTP server on 127.0.0.1:${actualPort}`);
      resolve({
        server,
        port: actualPort,
        // v0.7.5：close 時強制斷所有連線，避免 socket lingering 在 TIME_WAIT 卡住下次 bind
        close: () => new Promise((res) => {
          try {
            // Node 18.2+：把當下所有 socket 一次性 destroy
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyServer = server as any;
            if (typeof anyServer.closeAllConnections === 'function') {
              anyServer.closeAllConnections();
            }
          } catch {
            /* noop */
          }
          server.close(() => res());
        })
      });
    });
  });
}

/**
 * v0.7.5：包裝 createLocalFileServerOnce — 遇到 EADDRINUSE 自動 retry。
 *
 * 原因：上一次 named tunnel 的 socket 可能還在 TIME_WAIT（Windows 平台特別常見）。
 * 等個 1.5 / 3 / 4.5 秒讓 OS 釋放，再試一次。
 *
 * 若三次都失敗才丟原本的「port 被佔用」錯誤訊息。
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createLocalFileServer(args: {
  filePath: string;
  exposedName: string;
  port: number;
  onStatus?: (msg: string) => void;
}): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [1_500, 3_000, 4_500];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await createLocalFileServerOnce(args);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const isAddrInUse = err.code === 'EADDRINUSE' && args.port !== 0;
      if (!isAddrInUse || attempt === MAX_RETRIES) {
        if (isAddrInUse) {
          throw new Error(
            `本機 port ${args.port} 持續被佔用 ${MAX_RETRIES + 1} 次重試後仍無法綁定。\n` +
            `\n` +
            `這通常是上次 named tunnel 連線還在 TIME_WAIT 狀態，再等 30-60 秒應自動釋放。\n` +
            `\n` +
            `若一直無法解決，可：\n` +
            `  1. 完全結束 PuffinPuff（含系統匣圖示右鍵 → 結束）再重開\n` +
            `  2. 用 PowerShell 查佔用程式：netstat -ano | findstr :${args.port}\n` +
            `  3. 切回 quick tunnel 模式（設定 → IG 隧道工具）`
          );
        }
        throw err;
      }
      const delay = BACKOFF_MS[attempt];
      console.warn(`[tunnel] port ${args.port} 被佔用，第 ${attempt + 1}/${MAX_RETRIES} 次重試，${delay}ms 後...`);
      args.onStatus?.(`port ${args.port} 被前次連線佔用中，等 ${Math.round(delay / 1000)} 秒後重試（${attempt + 1}/${MAX_RETRIES}）...`);
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}

/**
 * 啟動 named tunnel 連線並等待就緒。
 * cloudflared stderr 出現 "Registered tunnel connection" → 視為就緒
 */
async function waitForNamedTunnelReady(
  proc: ChildProcess,
  timeoutMs: number
): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    let ready = false;
    let stderrAll = '';
    let stdoutAll = '';
    const MAX_LOG = 8_000;

    const onStderr = (chunk: Buffer): void => {
      const text = chunk.toString('utf-8');
      stderrAll += text;
      if (!ready && /Registered tunnel connection/i.test(text)) {
        ready = true;
        clearTimeout(timer);
        resolve({ stderr: stderrAll });
      }
    };
    const onStdout = (chunk: Buffer): void => {
      stdoutAll += chunk.toString('utf-8');
    };

    proc.stderr?.on('data', onStderr);
    proc.stdout?.on('data', onStdout);

    const truncate = (s: string): string =>
      s.length > MAX_LOG ? '…' + s.slice(-MAX_LOG) : s;

    const buildDiag = (prefix: string): string => {
      const e = stderrAll.trim();
      const o = stdoutAll.trim();
      let d = '';
      if (e) d += `\n[stderr]\n${truncate(e)}`;
      if (o) d += `\n[stdout]\n${truncate(o)}`;
      return `${prefix}${d || '\n（無輸出）'}`;
    };

    const timer = setTimeout(() => {
      if (!ready) reject(new Error(buildDiag('cloudflared named tunnel 啟動逾時（30 秒未連線）')));
    }, timeoutMs);

    proc.on('error', (e) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error(buildDiag(`cloudflared spawn 失敗：${e.message}`)));
      }
    });
    proc.on('exit', (code, signal) => {
      if (!ready) {
        clearTimeout(timer);
        const tag = signal ? `signal=${signal}` : `exit code ${code}`;
        reject(new Error(buildDiag(`cloudflared 異常結束（${tag}）`)));
      }
    });
  });
}

async function serveViaNamedCloudflareTunnel(
  opts: ServeOptions
): Promise<TunneledFile> {
  const { filePath, exposedName = 'video.mp4', onStatus } = opts;
  const config = getTunnelConfigInternal('named-cloudflare');
  if (!config) {
    throw new Error(
      'Named tunnel 模式已啟用，但找不到設定。\n' +
      '請至「設定 → IG 隧道工具（Named Tunnel）」填入 Cloudflare token + hostname，或切回 quick tunnel 模式。'
    );
  }

  // 1. 本機 HTTP server（固定 port，需要與 Cloudflare dashboard 設定的 service URL 對應）
  //    v0.7.5：port 被佔用時自動 retry 3 次，且 onStatus 即時回報給 UI
  const fs = await createLocalFileServer({
    filePath,
    exposedName,
    port: NAMED_TUNNEL_LOCAL_PORT,
    onStatus
  });

  // 2. spawn cloudflared with token
  const bin = await ensureCloudflared(onStatus);
  onStatus?.('啟動 Cloudflare named tunnel...');
  const proc = spawn(
    bin,
    // v0.5.3：完全拿掉 --no-autoupdate（不論放開頭或結尾都會觸發 help mode）。
    //         Windows 預設就不會 auto-update（cloudflared 啟動時會印 "cloudflared will not automatically update on Windows systems"）
    ['tunnel', 'run', '--token', config.token],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // 3. 等待 tunnel 連線就緒
  try {
    await waitForNamedTunnelReady(proc, 30_000);
    console.log('[tunnel] named tunnel ready for', config.publicHostname);
  } catch (e) {
    try {
      proc.kill();
    } catch {
      /* noop */
    }
    await fs.close();
    throw e;
  }

  return {
    url: `https://${config.publicHostname}/${exposedName}`,
    close: async () => {
      try {
        proc.kill();
      } catch {
        /* noop */
      }
      await fs.close();
      console.log('[tunnel] named tunnel closed');
    }
  };
}

/**
 * v0.5.0：測試 named tunnel 連線（給設定頁「測試連線」按鈕用）
 * 步驟：
 *   1. spawn cloudflared with token
 *   2. 等 "Registered tunnel connection"（最多 30 秒）
 *   3. HEAD https://<hostname> 確認 DNS + tunnel routing
 *   4. kill cloudflared
 */
export async function testNamedTunnelConnection(args: {
  token: string;
  publicHostname: string;
  onStatus?: (msg: string) => void;
}): Promise<{ ok: boolean; message: string }> {
  const { token, publicHostname, onStatus } = args;

  if (!token || token.trim().length < 10) {
    return { ok: false, message: 'Token 為空或長度不足，請貼入完整 token（一般以 eyJ... 開頭，數百字元長）' };
  }
  if (!publicHostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(publicHostname)) {
    return { ok: false, message: `Hostname 格式不正確：${publicHostname}` };
  }

  let proc: ChildProcess | null = null;
  try {
    const bin = await ensureCloudflared(onStatus);
    onStatus?.('啟動 cloudflared 測試連線（這需要 5-15 秒）...');
    proc = spawn(
      bin,
      // v0.5.3：完全拿掉 --no-autoupdate（Windows 預設不會 auto-update，加上反而觸發 cloudflared help mode bug）
      ['tunnel', 'run', '--token', token.trim()],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    await waitForNamedTunnelReady(proc, 30_000);

    // 確認 hostname 可解析 + tunnel 有 route 到（即使後端服務不通，能拿到 5xx/4xx 也代表 tunnel 本身 OK）
    onStatus?.(`測試 https://${publicHostname} 是否可達...`);
    try {
      const resp = await net.fetch(`https://${publicHostname}/`, {
        method: 'HEAD',
        redirect: 'manual'
      });
      // 任何 HTTP 回應都算 tunnel 連線正常（包含 404/502 — 因為我們現在沒在跑 local server）
      return {
        ok: true,
        message: `連線成功！Cloudflare tunnel 已就緒，hostname HTTP 回應碼 ${resp.status}（測試時沒跑 local server，所以 4xx/5xx 屬正常）。`
      };
    } catch (fetchErr) {
      const m = (fetchErr as Error).message;
      // DNS 錯誤 / 連不上 → hostname 設定有問題
      if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(m)) {
        return {
          ok: false,
          message: `Cloudflare tunnel 連線本身成功，但 DNS 找不到 ${publicHostname}。\n請確認 Cloudflare dashboard 已建立此 hostname 的 Public Hostname 規則。\n錯誤：${m}`
        };
      }
      return {
        ok: false,
        message: `Cloudflare tunnel 連線成功但 hostname 測試失敗：${m}`
      };
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  } finally {
    if (proc) {
      try {
        proc.kill();
      } catch {
        /* noop */
      }
    }
  }
}
