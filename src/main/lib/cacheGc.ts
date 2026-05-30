/**
 * 快取垃圾回收（GC）
 *
 * App 啟動時自動掃 userData 下的兩個快取資料夾，
 * 刪掉超過設定天數沒被讀取（atime）的檔案，避免長期累積。
 *
 * - transcoded/：發布前轉檔的暫存影片（5-50MB / 個）→ 預設 30 天
 * - thumbs/：影片縮圖（~50KB / 個）→ 預設 90 天（很小、清掉的代價低，但保守一點）
 *
 * 結果寫進 userData/.last_gc.json，供設定頁顯示「上次自動清理：X 個 / X MB」。
 */
import { app } from 'electron';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';

export interface CacheGcStats {
  /** 刪除的檔案數 */
  deleted: number;
  /** 釋放的位元組 */
  freedBytes: number;
  /** 掃描了多少檔案（不論刪不刪） */
  scanned: number;
}

export interface GcRunResult {
  ranAt: number;
  transcoded: CacheGcStats;
  thumbnails: CacheGcStats;
}

const STATE_FILE_NAME = '.last_gc.json';

function gcDir(dir: string, maxAgeDays: number): CacheGcStats {
  if (!existsSync(dir)) {
    return { deleted: 0, freedBytes: 0, scanned: 0 };
  }
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let freedBytes = 0;
  let scanned = 0;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (e) {
    console.warn(`[cacheGc] read ${dir} failed:`, e);
    return { deleted: 0, freedBytes: 0, scanned: 0 };
  }

  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    scanned += 1;

    // 用 atime 為主（最後讀取時間）；fallback 用 mtime（最後修改）
    // Windows 上預設 atime 不一定即時，但發布時讀檔會更新；保險起見取兩者較新值
    const lastAccessMs = Math.max(stat.atimeMs, stat.mtimeMs);
    if (lastAccessMs < cutoffMs) {
      try {
        unlinkSync(full);
        deleted += 1;
        freedBytes += stat.size;
      } catch (e) {
        console.warn(`[cacheGc] unlink ${full} failed:`, e);
      }
    }
  }

  return { deleted, freedBytes, scanned };
}

function stateFilePath(): string {
  return join(app.getPath('userData'), STATE_FILE_NAME);
}

function writeState(result: GcRunResult): void {
  try {
    writeFileSync(stateFilePath(), JSON.stringify(result, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[cacheGc] write state failed:', e);
  }
}

export function readLastGcResult(): GcRunResult | null {
  const file = stateFilePath();
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf-8');
    return JSON.parse(raw) as GcRunResult;
  } catch (e) {
    console.warn('[cacheGc] read state failed:', e);
    return null;
  }
}

export interface RunCacheGcOptions {
  /** 轉檔快取保留天數，預設 30 */
  transcodedKeepDays?: number;
  /** 縮圖快取保留天數，預設 90 */
  thumbnailsKeepDays?: number;
}

/**
 * 執行一次 GC，回傳本次清理結果。
 * App 啟動時呼叫一次即可（main process），結果寫進 .last_gc.json 供 UI 讀。
 */
export function runCacheGc(opts: RunCacheGcOptions = {}): GcRunResult {
  const transcodedKeepDays = opts.transcodedKeepDays ?? 30;
  const thumbnailsKeepDays = opts.thumbnailsKeepDays ?? 90;
  const userData = app.getPath('userData');

  console.log(
    `[cacheGc] running: transcoded > ${transcodedKeepDays}d, thumbs > ${thumbnailsKeepDays}d`
  );
  const transcoded = gcDir(join(userData, 'transcoded'), transcodedKeepDays);
  const thumbnails = gcDir(join(userData, 'thumbs'), thumbnailsKeepDays);
  console.log(
    `[cacheGc] done: transcoded ${transcoded.deleted}/${transcoded.scanned} (${(transcoded.freedBytes / 1024 / 1024).toFixed(1)} MB); ` +
      `thumbs ${thumbnails.deleted}/${thumbnails.scanned} (${(thumbnails.freedBytes / 1024).toFixed(1)} KB)`
  );

  const result: GcRunResult = {
    ranAt: Date.now(),
    transcoded,
    thumbnails
  };
  writeState(result);
  return result;
}
