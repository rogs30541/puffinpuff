import { app, dialog, ipcMain, net, shell, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isAutoLaunchEnabled,
  setAutoLaunch,
  isAutoLaunchPermanentlyDisabled,
  setAutoLaunchPermanentlyDisabled
} from '../lib/autoLaunch';
import { execute, query } from '../lib/database';
import { listPosts } from '../lib/postsRepo';
import { readLastGcResult, runCacheGc, type GcRunResult } from '../lib/cacheGc';
import { listAllMetaUserTokens, deleteMetaUserToken, type MetaUserTokenPublic } from '../lib/metaUserTokens';
import { runMetaTokenRefresh } from '../lib/metaTokenRefresher';
import { redownloadCloudflared } from '../lib/tunnel';

export interface SystemStats {
  thumbnailCount: number;
  thumbnailBytes: number;
  transcodedCount: number;
  transcodedBytes: number;
  historyCount: number;
  dataFolder: string;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
}

export function registerSystemHandlers(): void {
  ipcMain.handle('system:getAutoLaunch', (): boolean => isAutoLaunchEnabled());
  ipcMain.handle(
    'system:setAutoLaunch',
    (_event, enabled: boolean): boolean => {
      setAutoLaunch(enabled);
      return isAutoLaunchEnabled();
    }
  );

  // v0.3.3：永久停用此保護
  ipcMain.handle(
    'system:getAutoLaunchPermanentlyDisabled',
    (): boolean => isAutoLaunchPermanentlyDisabled()
  );
  ipcMain.handle(
    'system:setAutoLaunchPermanentlyDisabled',
    (_event, value: boolean): boolean => {
      setAutoLaunchPermanentlyDisabled(value);
      return isAutoLaunchPermanentlyDisabled();
    }
  );

  ipcMain.handle('system:getDataFolder', (): string => app.getPath('userData'));

  ipcMain.handle('system:openDataFolder', async (): Promise<boolean> => {
    await shell.openPath(app.getPath('userData'));
    return true;
  });

  ipcMain.handle('system:getStats', (): SystemStats => {
    const userData = app.getPath('userData');
    const sumSize = (dir: string): { count: number; bytes: number } => {
      const files = listFiles(dir);
      let bytes = 0;
      for (const f of files) {
        try {
          bytes += statSync(f).size;
        } catch {
          /* noop */
        }
      }
      return { count: files.length, bytes };
    };

    const thumbs = sumSize(join(userData, 'thumbs'));
    const transcoded = sumSize(join(userData, 'transcoded'));

    const row = query<{ c: number }>('SELECT COUNT(*) AS c FROM posts')[0];
    return {
      thumbnailCount: thumbs.count,
      thumbnailBytes: thumbs.bytes,
      transcodedCount: transcoded.count,
      transcodedBytes: transcoded.bytes,
      historyCount: row?.c ?? 0,
      dataFolder: userData
    };
  });

  ipcMain.handle('system:clearHistory', (): number => {
    // 先撈 post 數量
    const row = query<{ c: number }>("SELECT COUNT(*) AS c FROM posts WHERE status != 'scheduled'")[0];
    const cnt = row?.c ?? 0;
    // 保留 scheduled（未來會發），其他都清
    execute("DELETE FROM posts WHERE status != 'scheduled'");
    // post_targets 透過 FK CASCADE 自動清
    return cnt;
  });

  const clearDir = (
    dir: string
  ): { deleted: number; freedBytes: number } => {
    const files = listFiles(dir);
    let deleted = 0;
    let freedBytes = 0;
    for (const f of files) {
      try {
        freedBytes += statSync(f).size;
        unlinkSync(f);
        deleted += 1;
      } catch {
        /* noop */
      }
    }
    mkdirSync(dir, { recursive: true });
    return { deleted, freedBytes };
  };

  ipcMain.handle('system:clearThumbnails', (): { deleted: number; freedBytes: number } => {
    return clearDir(join(app.getPath('userData'), 'thumbs'));
  });

  ipcMain.handle('system:clearTranscoded', (): { deleted: number; freedBytes: number } => {
    return clearDir(join(app.getPath('userData'), 'transcoded'));
  });

  ipcMain.handle('system:getVersion', (): string => app.getVersion());

  ipcMain.handle('system:getLastGc', (): GcRunResult | null => readLastGcResult());
  ipcMain.handle('system:runGcNow', (): GcRunResult => runCacheGc());

  // === Meta long-lived user token 自動續期（v0.2.5）===
  ipcMain.handle('system:listMetaUserTokens', (): MetaUserTokenPublic[] => listAllMetaUserTokens());
  ipcMain.handle('system:refreshMetaTokens', async () => {
    return await runMetaTokenRefresh({ force: true });
  });
  // v0.9.7：清理無用 token（同 FB user 換密碼/重連後留下的失效舊列）
  ipcMain.handle('system:deleteMetaUserToken', (_e, fbUserId: string): boolean => {
    deleteMetaUserToken(fbUserId);
    console.log(`[meta-tokens] deleted user token fb_user_id=${fbUserId}`);
    return true;
  });

  // === v0.4.0：匯出歷史紀錄 CSV ===
  ipcMain.handle('system:exportHistoryCsv', async (event): Promise<{ ok: boolean; path?: string; rows?: number; cancelled?: boolean }> => {
    const posts = listPosts();

    const headers = [
      'post_id', 'title', 'post_type', 'created_at', 'finished_at', 'overall_status',
      'platform', 'account_name', 'target_status', 'remote_id', 'remote_url', 'error_message'
    ];
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
      return s;
    };
    const rows: string[] = [headers.join(',')];
    for (const post of posts) {
      const createdAt = new Date(post.createdAt).toISOString();
      const finishedAt = post.finishedAt ? new Date(post.finishedAt).toISOString() : '';
      if (post.targets.length === 0) {
        rows.push([
          post.id, escapeCsv(post.title), post.postType ?? 'video',
          createdAt, finishedAt, post.status,
          '', '', '', '', '', ''
        ].join(','));
      } else {
        for (const t of post.targets) {
          rows.push([
            post.id, escapeCsv(post.title), post.postType ?? 'video',
            createdAt, finishedAt, post.status,
            t.platform, escapeCsv(t.accountName), t.status,
            escapeCsv(t.remoteId), escapeCsv(t.remoteUrl), escapeCsv(t.errorMessage)
          ].join(','));
        }
      }
    }
    const csvText = '﻿' + rows.join('\r\n'); // BOM 讓 Excel 自動 UTF-8

    const win = BrowserWindow.fromWebContents(event.sender);
    const defaultName = `puffinpuff_history_${new Date().toISOString().slice(0, 10)}.csv`;
    const result = await dialog.showSaveDialog(win ?? new BrowserWindow(), {
      title: '匯出歷史紀錄為 CSV',
      defaultPath: defaultName,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, cancelled: true };
    }
    try {
      writeFileSync(result.filePath, csvText, 'utf-8');
      return { ok: true, path: result.filePath, rows: posts.length };
    } catch (e) {
      throw new Error(`寫檔失敗：${(e as Error).message}`);
    }
  });

  // === v0.6.9：開 DevTools（debug 用）===
  ipcMain.handle('system:openDevTools', (event): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.webContents.openDevTools({ mode: 'detach' });
      return true;
    }
    return false;
  });

  // === v0.4.6：手動重新下載 cloudflared（IG 上傳隧道工具）===
  ipcMain.handle(
    'system:redownloadCloudflared',
    async (): Promise<{ ok: boolean; path?: string; bytes?: number; error?: string }> => {
      try {
        const result = await redownloadCloudflared();
        return { ok: true, path: result.path, bytes: result.bytes };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
  );

  // === v0.4.0：自我更新檢查 ===
  ipcMain.handle('system:checkForUpdate', async (): Promise<{
    latest: string;
    current: string;
    newer: boolean;
    downloadUrl?: string;
    releaseNotes?: string;
  }> => {
    const current = app.getVersion();
    try {
      // 避免快取：cache-busting query string（Electron net.fetch RequestInit 不支援 cache 欄位）
      const resp = await net.fetch(
        `https://mememaker-tw.com/puffinpuff/version.json?t=${Math.floor(Date.now() / 60000)}`
      );
      if (!resp.ok) {
        return { latest: current, current, newer: false };
      }
      const data = (await resp.json()) as { latest?: string; downloadUrl?: string; releaseNotes?: string };
      const latest = data.latest ?? current;
      const newer = compareVersions(latest, current) > 0;
      return { latest, current, newer, downloadUrl: data.downloadUrl, releaseNotes: data.releaseNotes };
    } catch (e) {
      console.warn('[updateCheck] failed:', (e as Error).message);
      return { latest: current, current, newer: false };
    }
  });
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const x = partsA[i] ?? 0;
    const y = partsB[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
