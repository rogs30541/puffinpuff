/**
 * v0.10.1：App 自動更新（electron-updater + GitHub Releases）
 *
 * 流程：
 *  - 啟動 15 秒後自動檢查一次（只在打包後的正式版；dev 模式不檢查）
 *  - 側欄「檢查更新」可手動觸發
 *  - 發現新版 → 使用者按「下載」→ 進度回報 → 下載完按「重啟安裝」
 *  - autoDownload 關閉：下載與安裝都由使用者決定，不偷跑
 *
 * 更新源：electron-builder.yml 的 publish(github) → build 內嵌 app-update.yml，
 *         release 上的 latest.yml + PuffinPuff-x.y.z-Setup.exe 為實際 feed。
 */
import { app, ipcMain, type WebContents } from 'electron';
import { autoUpdater } from 'electron-updater';

export interface UpdateCheckResult {
  status: 'available' | 'latest' | 'dev' | 'error';
  currentVersion: string;
  latestVersion?: string;
  notes?: string;
  message?: string;
}

let wired = false;
let lastWebContents: WebContents | null = null;

function send(channel: string, payload: unknown): void {
  if (lastWebContents && !lastWebContents.isDestroyed()) {
    lastWebContents.send(channel, payload);
  }
}

function wireEvents(): void {
  if (wired) return;
  wired = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('download-progress', (p) => {
    send('updates:progress', {
      percent: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('updates:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (e) => {
    send('updates:error', { message: e.message });
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  if (!app.isPackaged) {
    return { status: 'dev', currentVersion, message: 'dev 模式不檢查更新' };
  }
  wireEvents();
  try {
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (latest && latest !== currentVersion && result?.isUpdateAvailable !== false) {
      // electron-updater 自己會比 semver；isUpdateAvailable 為準
      const available = result.isUpdateAvailable ?? latest !== currentVersion;
      if (available) {
        return {
          status: 'available',
          currentVersion,
          latestVersion: latest,
          notes: typeof result.updateInfo.releaseNotes === 'string'
            ? result.updateInfo.releaseNotes.slice(0, 500)
            : undefined
        };
      }
    }
    return { status: 'latest', currentVersion, latestVersion: latest ?? currentVersion };
  } catch (e) {
    return { status: 'error', currentVersion, message: (e as Error).message.slice(0, 300) };
  }
}

export function registerUpdateHandlers(): void {
  ipcMain.handle('updates:check', async (event): Promise<UpdateCheckResult> => {
    lastWebContents = event.sender;
    return checkForUpdates();
  });

  ipcMain.handle('updates:download', async (event): Promise<boolean> => {
    lastWebContents = event.sender;
    if (!app.isPackaged) return false;
    wireEvents();
    await autoUpdater.downloadUpdate();
    return true;
  });

  ipcMain.handle('updates:install', (): boolean => {
    if (!app.isPackaged) return false;
    // isSilent=false（跑 NSIS UI）、isForceRunAfter=true（裝完自動重開）
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
  });
}

/**
 * 自動檢查排程：
 *  - 啟動 15 秒後檢查一次
 *  - 之後每 24 小時檢查一次（v0.10.2 — app 常駐系統匣，長開也會收到新版通知）
 *  - 同一個新版本只通知一次，不重複騷擾
 */
const DAILY_CHECK_MS = 24 * 60 * 60 * 1000;
let lastNotifiedVersion: string | null = null;

export function scheduleStartupUpdateCheck(getWebContents: () => WebContents | null): void {
  if (!app.isPackaged) return;
  const runCheck = async (): Promise<void> => {
    const wc = getWebContents();
    if (wc) lastWebContents = wc;
    const result = await checkForUpdates();
    if (
      result.status === 'available' &&
      result.latestVersion &&
      result.latestVersion !== lastNotifiedVersion
    ) {
      lastNotifiedVersion = result.latestVersion;
      send('updates:available', result);
      console.log(`[updates] 發現新版 v${result.latestVersion}（目前 v${result.currentVersion}）`);
    }
  };
  setTimeout(() => void runCheck(), 15_000);
  setInterval(() => void runCheck(), DAILY_CHECK_MS);
}
