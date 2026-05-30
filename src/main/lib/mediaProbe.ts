import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import ffprobePath from 'ffprobe-static';

export interface VideoSpec {
  type: 'video';
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  codec: string;
  bitrate: number; // bits per second
  aspectRatio: string; // e.g. "9:16"
  hasAudio: boolean;
}

export interface ImageSpec {
  type: 'image';
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export type MediaSpec = VideoSpec | ImageSpec;

interface FFProbeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
}

interface FFProbeOutput {
  streams: FFProbeStream[];
  format: {
    filename: string;
    format_name: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
  };
}

function getFFprobeBinary(): string {
  // ffprobe-static exports an object with `path` property (in CJS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ffprobePath as unknown as string | { path: string };
  const rawPath = typeof raw === 'string' ? raw : raw.path;
  // packaged app 內 path 指向 app.asar，但 binary 無法從 asar 直接執行
  // electron-builder.yml 的 asarUnpack 已把它解壓到 app.asar.unpacked，需改路徑
  return rawPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

async function runFFprobe(filePath: string): Promise<FFProbeOutput> {
  const binary = getFFprobeBinary();
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      filePath
    ]);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        const err = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`ffprobe 失敗（exit ${code}）：${err}`));
        return;
      }
      try {
        const output = JSON.parse(Buffer.concat(stdoutChunks).toString('utf-8'));
        resolve(output as FFProbeOutput);
      } catch (e) {
        reject(new Error(`ffprobe 輸出解析失敗：${(e as Error).message}`));
      }
    });
  });
}

function parseFrameRate(r: string | undefined): number {
  if (!r) return 0;
  const [num, denom] = r.split('/').map(Number);
  if (!num || !denom) return 0;
  return num / denom;
}

function computeAspectRatio(w: number, h: number): string {
  if (!w || !h) return '?';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export async function probeMedia(filePath: string): Promise<MediaSpec> {
  const stat = statSync(filePath);
  const data = await runFFprobe(filePath);

  const videoStream = data.streams.find((s) => s.codec_type === 'video');
  const audioStream = data.streams.find((s) => s.codec_type === 'audio');

  if (!videoStream) {
    throw new Error('找不到影像串流（這個檔案可能不是影片）');
  }

  // 圖片（單一影像、無時長或時長極短）
  const isImage =
    !data.format.duration ||
    parseFloat(data.format.duration) < 0.1 ||
    /image2|png_pipe|jpeg|gif/.test(data.format.format_name);

  if (isImage) {
    return {
      type: 'image',
      filePath,
      fileName: basename(filePath),
      fileSizeBytes: stat.size,
      width: videoStream.width ?? 0,
      height: videoStream.height ?? 0
    };
  }

  const width = videoStream.width ?? 0;
  const height = videoStream.height ?? 0;
  const durationSec = parseFloat(data.format.duration ?? '0');
  const fps = parseFrameRate(videoStream.r_frame_rate);
  const bitrate = parseInt(data.format.bit_rate ?? videoStream.bit_rate ?? '0', 10);

  return {
    type: 'video',
    filePath,
    fileName: basename(filePath),
    fileSizeBytes: stat.size,
    width,
    height,
    durationSec,
    fps,
    codec: videoStream.codec_name ?? 'unknown',
    bitrate,
    aspectRatio: computeAspectRatio(width, height),
    hasAudio: !!audioStream
  };
}

// 跨平台規格驗證
export interface PlatformValidation {
  platform: 'youtube' | 'facebook' | 'instagram';
  compatible: boolean;
  needsTranscode: boolean;
  reasons: string[]; // 不符的原因
}

// 平台規格設定（時長限制以官方最新政策為準，2026-05 校對）
// YouTube Shorts：2024-10 起放寬到 180 秒
// FB Reels / IG Reels：2026 起放寬到 180 秒（3 分鐘） — 超過會被 Meta API 拒絕但訊息只回 "Authorization Error"（code 100）很誤導
const PLATFORM_SPECS = {
  youtube: {
    minH: 720,
    minDuration: 5,
    maxDuration: 180,
    ratio: '9:16',
    maxSizeMB: 256 * 1024
  },
  facebook: {
    minH: 960,
    minDuration: 3,
    maxDuration: 180,
    ratio: '9:16',
    maxSizeMB: 1024
  },
  instagram: {
    minH: 960,
    minDuration: 3,
    maxDuration: 180,
    ratio: '9:16',
    maxSizeMB: 1024
  }
};

export function validateForPlatforms(spec: MediaSpec): PlatformValidation[] {
  if (spec.type !== 'video') {
    return (['youtube', 'facebook', 'instagram'] as const).map((p) => ({
      platform: p,
      compatible: false,
      needsTranscode: true,
      reasons: ['目前僅支援影片格式']
    }));
  }

  return (Object.keys(PLATFORM_SPECS) as Array<keyof typeof PLATFORM_SPECS>).map(
    (platform) => {
      const target = PLATFORM_SPECS[platform];
      const reasons: string[] = [];
      let needsTranscode = false;

      if (spec.aspectRatio !== target.ratio) {
        reasons.push(`比例為 ${spec.aspectRatio}（需 ${target.ratio}）`);
        needsTranscode = true;
      }
      if (spec.height < target.minH) {
        reasons.push(`高度 ${spec.height}px（需 ≥ ${target.minH}px）`);
        needsTranscode = true;
      }
      if (spec.durationSec < target.minDuration) {
        reasons.push(
          `時長 ${spec.durationSec.toFixed(1)}s（需 ${target.minDuration}–${target.maxDuration}s）`
        );
      }
      if (spec.durationSec > target.maxDuration) {
        reasons.push(
          `時長 ${spec.durationSec.toFixed(1)}s（需 ${target.minDuration}–${target.maxDuration}s）`
        );
      }
      const sizeMB = spec.fileSizeBytes / (1024 * 1024);
      if (sizeMB > target.maxSizeMB) {
        reasons.push(`大小 ${sizeMB.toFixed(0)}MB（需 ≤ ${target.maxSizeMB}MB）`);
      }

      return {
        platform,
        compatible: reasons.length === 0,
        needsTranscode,
        reasons
      };
    }
  );
}
