/**
 * v0.4.1：資料夾監聽服務
 *
 * 啟動時：
 *   1. 讀 enabled watched_folders
 *   2. 對每個資料夾起 fs.watch（依賴系統，可能 INODE / 換名 / 刪除事件）
 *   3. 也在啟動時掃一次資料夾（撿掉 App 關閉期間漏接的新檔）
 *
 * 收到新檔事件：
 *   1. debounce 5 秒（避免抓到複製中的檔案、避免事件重複）
 *   2. 檢查是否是影片（依副檔名）
 *   3. 套模板建立排程（scheduledAt = watcher.nextScheduleAt）
 *   4. 推進 nextScheduleAt += intervalHours
 *   5. 移檔到 `<folder>/_processed/yyyy-mm/<filename>` 留紀錄
 *   6. 系統通知告知
 */

import { existsSync, mkdirSync, renameSync, statSync, watch, readdirSync, type FSWatcher } from 'node:fs';
import { join, extname, basename, sep as pathSep } from 'node:path';
import { listWatchedFolders, advanceWatchedFolderAfterProcess, getWatchedFolderById } from './watchedFoldersRepo';
import { createScheduledPost } from './scheduler';
import { notifySimple } from './notifyService';
import { substituteTitleFilename, DEFAULT_PUBLISH_CONTENT } from '../../shared/types';
import type { WatchedFolder, PublishContent } from '../../shared/types';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi']);
const DEBOUNCE_MS = 5_000;

const watchers = new Map<number, FSWatcher>();
const pendingFiles = new Map<string, NodeJS.Timeout>(); // path → debounce timer

function buildContent(watcher: WatchedFolder, fileName: string): PublishContent {
  const t = watcher.template;
  const title = substituteTitleFilename(t.titleTemplate, fileName);
  return {
    common: {
      title,
      description: t.description,
      hashtags: t.hashtags,
      privacy: t.privacy
    },
    perPlatform: {
      youtube: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.youtube,
        enabled: t.platforms.includes('youtube'),
        ...(t.targetAccounts?.youtube ? { accountId: t.targetAccounts.youtube } : {})
      },
      facebook: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.facebook,
        enabled: t.platforms.includes('facebook'),
        ...(t.targetAccounts?.facebook ? { accountId: t.targetAccounts.facebook } : {})
      },
      instagram: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.instagram,
        enabled: t.platforms.includes('instagram'),
        ...(t.targetAccounts?.instagram ? { accountId: t.targetAccounts.instagram } : {})
      },
      // v0.7.0：folderWatcher 既有監聽器預設不啟 Threads（避免突然多發一平台）
      threads: { ...DEFAULT_PUBLISH_CONTENT.perPlatform.threads, enabled: false }
    }
  };
}

function moveToProcessed(watcher: WatchedFolder, filePath: string): string {
  const now = new Date();
  const ymPath = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetDir = join(watcher.folderPath, '_processed', ymPath);
  try {
    mkdirSync(targetDir, { recursive: true });
  } catch (e) {
    console.warn('[watcher] mkdir processed failed:', (e as Error).message);
    return filePath; // 留原檔
  }
  const fileName = basename(filePath);
  let targetPath = join(targetDir, fileName);
  if (existsSync(targetPath)) {
    const ext = extname(fileName);
    const stem = basename(fileName, ext);
    targetPath = join(targetDir, `${stem}_${Date.now()}${ext}`);
  }
  try {
    renameSync(filePath, targetPath);
    console.log(`[watcher] moved ${filePath} → ${targetPath}`);
    return targetPath;
  } catch (e) {
    console.warn('[watcher] rename failed:', (e as Error).message);
    return filePath;
  }
}

function isFileStable(filePath: string): boolean {
  try {
    const s1 = statSync(filePath);
    // 短暫等待後再 stat 比較
    // 為了同步化簡單，這裡只檢查存在
    return s1.isFile();
  } catch {
    return false;
  }
}

async function processNewFile(watcher: WatchedFolder, filePath: string): Promise<void> {
  if (!isFileStable(filePath)) return;
  const ext = extname(filePath).toLowerCase();
  if (!VIDEO_EXTS.has(ext)) return;

  // 跳過已在 _processed 內的檔案
  if (filePath.includes(`${pathSep}_processed${pathSep}`)) {
    return;
  }

  const fileName = basename(filePath);
  console.log(`[watcher #${watcher.id}] processing new file: ${fileName}`);

  try {
    const content = buildContent(watcher, fileName);
    const scheduledAt = watcher.nextScheduleAt;
    // 若已過期 → 從現在 + 1 分鐘
    const finalScheduledAt = scheduledAt < Date.now() ? Date.now() + 60_000 : scheduledAt;

    // 移檔到 _processed（避免重複處理 + 留紀錄）
    const newFilePath = moveToProcessed(watcher, filePath);

    createScheduledPost({
      filePath: newFilePath,
      fileName,
      thumbnailPath: null,
      content,
      scheduledAt: finalScheduledAt
    });

    // 推進 nextScheduleAt
    const newNext = finalScheduledAt + watcher.intervalHours * 60 * 60 * 1000;
    advanceWatchedFolderAfterProcess(watcher.id, newNext);

    notifySimple(
      `PuffinPuff 自動排程 1 篇`,
      `「${watcher.label ?? watcher.folderPath}」收到新影片：${fileName}，排到 ${new Date(finalScheduledAt).toLocaleString('zh-TW')}`
    );
  } catch (e) {
    console.error(`[watcher #${watcher.id}] process failed:`, e);
    advanceWatchedFolderAfterProcess(watcher.id, watcher.nextScheduleAt, (e as Error).message);
  }
}

function debounceProcess(watcher: WatchedFolder, filePath: string): void {
  const existing = pendingFiles.get(filePath);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingFiles.delete(filePath);
    // 重新 load watcher（可能設定有變更）
    const fresh = getWatchedFolderById(watcher.id);
    if (fresh && fresh.enabled) {
      processNewFile(fresh, filePath).catch((e) => {
        console.error('[watcher] process error:', e);
      });
    }
  }, DEBOUNCE_MS);
  pendingFiles.set(filePath, timer);
}

function startWatcher(watcher: WatchedFolder): void {
  if (!watcher.enabled) return;
  if (!existsSync(watcher.folderPath)) {
    console.warn(`[watcher #${watcher.id}] folder not found: ${watcher.folderPath}`);
    return;
  }
  if (watchers.has(watcher.id)) {
    watchers.get(watcher.id)!.close();
  }

  try {
    const w = watch(watcher.folderPath, { persistent: true }, (eventType, filename) => {
      if (!filename) return;
      const filePath = join(watcher.folderPath, filename);
      // rename event = 檔案新增或刪除；change event = 內容變更
      if (eventType === 'rename' && existsSync(filePath)) {
        debounceProcess(watcher, filePath);
      }
    });
    watchers.set(watcher.id, w);
    console.log(`[watcher #${watcher.id}] started watching: ${watcher.folderPath}`);

    // 啟動時也掃一次撿掉漏接的檔
    try {
      const existing = readdirSync(watcher.folderPath).filter((name) => {
        if (name.startsWith('_processed')) return false;
        const ext = extname(name).toLowerCase();
        return VIDEO_EXTS.has(ext);
      });
      for (const name of existing) {
        const filePath = join(watcher.folderPath, name);
        debounceProcess(watcher, filePath);
      }
      if (existing.length > 0) {
        console.log(`[watcher #${watcher.id}] found ${existing.length} existing files to process`);
      }
    } catch (e) {
      console.warn(`[watcher #${watcher.id}] initial scan failed:`, (e as Error).message);
    }
  } catch (e) {
    console.error(`[watcher #${watcher.id}] watch failed:`, (e as Error).message);
  }
}

function stopWatcher(id: number): void {
  const w = watchers.get(id);
  if (w) {
    w.close();
    watchers.delete(id);
    console.log(`[watcher #${id}] stopped`);
  }
}

export function startAllWatchers(): void {
  const all = listWatchedFolders();
  for (const w of all) {
    if (w.enabled) startWatcher(w);
  }
  console.log(`[watcher] started ${watchers.size} watchers`);
}

export function stopAllWatchers(): void {
  for (const id of watchers.keys()) {
    stopWatcher(id);
  }
  for (const timer of pendingFiles.values()) {
    clearTimeout(timer);
  }
  pendingFiles.clear();
}

/** 設定變更後重啟某個 watcher（給 IPC handler 用）*/
export function restartWatcher(id: number): void {
  stopWatcher(id);
  const w = getWatchedFolderById(id);
  if (w && w.enabled) startWatcher(w);
}
