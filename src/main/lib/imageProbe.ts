/**
 * 用 ffprobe 取圖檔解析度（width × height）
 * 不需要新依賴，重用已有的 ffprobe-static
 */

import { spawn } from 'node:child_process';
import ffprobePath from 'ffprobe-static';

function getFFprobeBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ffprobePath as unknown as { path?: string } | string | null;
  if (!raw) throw new Error('ffprobe binary 找不到');
  const rawPath = typeof raw === 'string' ? raw : (raw.path ?? '');
  return rawPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * 取圖檔解析度。失敗回 null（不 throw）。
 * 用 ffprobe -select_streams v:0 -show_entries stream=width,height
 */
export async function probeImageDimensions(imagePath: string): Promise<ImageDimensions | null> {
  const binary = getFFprobeBinary();
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      imagePath
    ];
    const proc = spawn(binary, args);
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout) as {
          streams?: Array<{ width?: number; height?: number }>;
        };
        const s = data.streams?.[0];
        if (s?.width && s?.height) {
          resolve({ width: s.width, height: s.height });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * IG Feed 規格驗證（給警告用）
 * - 最小 320×320
 * - 比例 4:5 (0.8) 到 1.91:1 (1.91) 之間
 * - 最大邊長 1080 推薦上限（不會被拒，但建議 ≤ 1080×1920）
 */
export interface IgValidation {
  valid: boolean;
  warnings: string[];
}

export function validateForInstagram(dim: ImageDimensions | null): IgValidation {
  const warnings: string[] = [];
  if (!dim) {
    return { valid: true, warnings: ['無法讀取圖檔解析度（會嘗試發布，IG 可能拒收）'] };
  }
  const { width, height } = dim;
  if (width < 320 || height < 320) {
    warnings.push(`解析度過低（${width}×${height}）— IG 最低 320×320，發布會失敗`);
    return { valid: false, warnings };
  }
  const aspect = width / height;
  if (aspect < 0.79) {
    warnings.push(`太直 (${aspect.toFixed(2)}) — IG 接受 4:5 (0.8) ~ 1.91:1，過直會被裁切`);
  } else if (aspect > 1.92) {
    warnings.push(`太寬 (${aspect.toFixed(2)}) — IG 接受 4:5 (0.8) ~ 1.91:1，過寬會被裁切`);
  }
  // 建議解析度範圍
  if (width > 1440 || height > 1800) {
    warnings.push(`解析度偏大 (${width}×${height}) — IG 會自動降到 1080 寬，建議改 1080×1350 (4:5)`);
  }
  return { valid: warnings.length === 0, warnings };
}
