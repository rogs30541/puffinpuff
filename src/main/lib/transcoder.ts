import { spawn } from 'node:child_process';
import { app } from 'electron';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

function getFFmpegBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ffmpegPath as unknown as string | { path?: string } | null;
  if (!raw) throw new Error('ffmpeg binary 找不到');
  const rawPath = typeof raw === 'string' ? raw : (raw.path ?? '');
  return rawPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

function transcodeDir(): string {
  const dir = join(app.getPath('userData'), 'transcoded');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fileHash(filePath: string): string {
  const stat = statSync(filePath);
  return createHash('sha1')
    .update(`${filePath}|${stat.size}|${stat.mtimeMs}`)
    .digest('hex')
    .slice(0, 16);
}

export interface TranscodeProgressEvent {
  percent: number;
  /** 已處理秒數（依 ffmpeg 輸出解析） */
  currentSec: number;
  /** 影片總秒數 */
  totalSec: number;
}

export interface TranscodeOptions {
  inputPath: string;
  /** 影片總秒數（用來算 % 進度） */
  durationSec: number;
  /** 目標解析度 W×H，預設 1080×1920 */
  targetWidth?: number;
  targetHeight?: number;
  /** 目標 fps，預設 30 */
  targetFps?: number;
  onProgress?: (e: TranscodeProgressEvent) => void;
}

/**
 * 將影片轉檔成 9:16 H.264 1080×1920 30fps yuv420p（社群平台通用相容格式）
 *
 * 邏輯：
 *  - 若不足 9:16 → letterbox 加黑邊（preserve content）
 *  - 超過 9:16 → 裁切置中
 *  - 編碼器：libx264 + yuv420p（YouTube/FB/IG 都吃）
 *  - 音訊：AAC 128k（若有）
 *
 * 輸出至 `userData\transcoded\{hash}.mp4`，hash 含檔案路徑+大小+mtime 避免重複轉
 */
export async function transcodeForSocial(
  opts: TranscodeOptions
): Promise<string> {
  const targetW = opts.targetWidth ?? 1080;
  const targetH = opts.targetHeight ?? 1920;
  const targetFps = opts.targetFps ?? 30;
  const hash = fileHash(opts.inputPath);
  const outPath = join(transcodeDir(), `${hash}_${targetW}x${targetH}.mp4`);

  // 已轉過 → 直接回傳
  if (existsSync(outPath)) {
    console.log(`[transcode] cache hit: ${outPath}`);
    opts.onProgress?.({
      percent: 100,
      currentSec: opts.durationSec,
      totalSec: opts.durationSec
    });
    return outPath;
  }

  const binary = getFFmpegBinary();

  // 影片濾鏡：先 scale 到符合，然後 letterbox 加黑邊置中
  // scale=W:H:force_original_aspect_ratio=decrease → 縮到框內
  // pad=W:H:(ow-iw)/2:(oh-ih)/2:black → 補黑邊置中
  const vf = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${targetFps}`;

  const args = [
    '-y',
    '-i',
    opts.inputPath,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outPath
  ];

  console.log(`[transcode] ${opts.inputPath} → ${outPath}`);
  console.log(`[transcode] ffmpeg ${args.join(' ')}`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binary, args);

    proc.stderr.on('data', (chunk: Buffer) => {
      // ffmpeg 把進度輸出到 stderr：`frame=  123 fps= 30 time=00:00:04.10 ...`
      const text = chunk.toString('utf-8');
      const m = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (m && opts.onProgress) {
        const h = parseInt(m[1], 10);
        const mn = parseInt(m[2], 10);
        const s = parseInt(m[3], 10);
        const cs = parseInt(m[4], 10);
        const currentSec = h * 3600 + mn * 60 + s + cs / 100;
        const percent =
          opts.durationSec > 0 ? Math.min(99, (currentSec / opts.durationSec) * 100) : 0;
        opts.onProgress({ percent, currentSec, totalSec: opts.durationSec });
      }
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        opts.onProgress?.({
          percent: 100,
          currentSec: opts.durationSec,
          totalSec: opts.durationSec
        });
        resolve();
      } else {
        reject(new Error(`ffmpeg 轉檔失敗（exit ${code}）`));
      }
    });
  });

  return outPath;
}
