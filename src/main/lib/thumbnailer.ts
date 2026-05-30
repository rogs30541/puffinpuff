import { spawn } from 'node:child_process';
import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

function getFFmpegBinary(): string {
  // ffmpeg-static exports the path as a string in CJS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ffmpegPath as unknown as string | { path?: string } | null;
  if (!raw) throw new Error('ffmpeg binary 找不到');
  const rawPath = typeof raw === 'string' ? raw : (raw.path ?? '');
  // packaged app 同上：把 asar 路徑改成 asar.unpacked
  return rawPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

function thumbsDir(): string {
  const dir = join(app.getPath('userData'), 'thumbs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function pathHash(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex').slice(0, 16);
}

/**
 * 從影片擷取縮圖，存到 userData/thumbs/{hash}.jpg
 * 已存在則直接回傳路徑，不重新生成
 */
export async function generateThumbnail(videoPath: string, atSec = 1): Promise<string> {
  const hash = pathHash(videoPath);
  const outPath = join(thumbsDir(), `${hash}.jpg`);

  if (existsSync(outPath)) {
    return outPath;
  }

  const binary = getFFmpegBinary();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binary, [
      '-ss',
      String(atSec),
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-q:v',
      '3',
      '-y',
      outPath
    ]);

    const stderrChunks: Buffer[] = [];
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const err = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`ffmpeg 縮圖失敗（exit ${code}）：${err.slice(0, 500)}`));
      }
    });
  });

  return outPath;
}
