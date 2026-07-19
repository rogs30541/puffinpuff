import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  shell,
  Tray
} from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import contextMenu from 'electron-context-menu';
import { closeDatabase, initDatabase } from './lib/database';
import { registerAccountsHandlers } from './ipc/accountsHandlers';
import { registerMediaHandlers } from './ipc/mediaHandlers';
import { registerPublishHandlers } from './ipc/publishHandlers';
import { registerPostsHandlers } from './ipc/postsHandlers';
import { registerScheduleHandlers } from './ipc/scheduleHandlers';
import { registerSystemHandlers } from './ipc/systemHandlers';
import { bootstrapSchedulesFromDB, shutdownScheduler } from './lib/scheduler';
import { notifySimple, setupNotificationIdentity } from './lib/notifyService';
import { buildApplicationMenu } from './appMenu';
import { runCacheGc } from './lib/cacheGc';
import { startMetaTokenRefreshSchedule, stopMetaTokenRefreshSchedule } from './lib/metaTokenRefresher';
import { registerWatchersHandlers } from './ipc/watchersHandlers';
import { registerTunnelHandlers } from './ipc/tunnelHandlers';
import { registerCredentialsHandlers } from './ipc/credentialsHandlers';
import { registerTemplatesHandlers } from './ipc/templatesHandlers';
import { startAllWatchers, stopAllWatchers } from './lib/folderWatcher';
import { existsSync as fsExistsSync, writeFileSync as fsWriteFileSync } from 'node:fs';
import { setAutoLaunch, isAutoLaunchEnabled, isAutoLaunchPermanentlyDisabled } from './lib/autoLaunch';

const isDev = !app.isPackaged;

// 全域 state：是否在「真正結束」流程中
let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let hasShownTrayNotice = false; // 第一次 minimize to tray 提示

// 防止多重啟動：第二次啟動時把現有視窗叫到前面
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
app.on('second-instance', () => {
  showMainWindow();
});

// 右鍵選單：套用在所有 BrowserWindow（包含 OAuth 視窗）
contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showCopyImage: true,
  showSaveImageAs: true,
  showCopyLink: true,
  showInspectElement: isDev,
  labels: {
    cut: '剪下',
    copy: '複製',
    paste: '貼上',
    selectAll: '全選',
    saveImage: '儲存影像',
    saveImageAs: '影像另存為…',
    copyLink: '複製連結網址',
    copyImage: '複製影像',
    copyImageAddress: '複製影像網址',
    inspect: '檢視元素（開發）'
  }
});

// 註冊 puffin-media 為 privileged scheme
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'puffin-media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false
    }
  }
]);

function getTrayIconPath(): string {
  // packaged：在 resources/icon.png（透過 extraResources 配置）
  // dev：在 build/icon.png
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png');
  }
  return join(app.getAppPath(), 'build', 'icon.png');
}

function createMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  const iconPath = getTrayIconPath();
  const windowIcon = existsSync(iconPath) ? iconPath : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: '海鸚泡芙 PuffinPuff',
    backgroundColor: '#FBF7F2',
    icon: windowIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 關閉視窗時：若不是真的要結束，就隱藏到 tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (!hasShownTrayNotice) {
        hasShownTrayNotice = true;
        notifySimple(
          'PuffinPuff 仍在背景運作',
          '視窗已隱藏到系統匣（右下角箭頭內），排程持續執行。在系統匣海鸚圖示按右鍵可顯示主視窗或結束 App。'
        );
      }
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function navigateAndShow(target: 'publish' | 'schedule' | 'history' | 'accounts' | 'settings'): void {
  showMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nav:goto', target);
  }
}

function createTray(): void {
  const iconPath = getTrayIconPath();
  if (!existsSync(iconPath)) {
    console.warn('[tray] icon not found at', iconPath);
    return;
  }

  // 系統匣圖示通常需要小尺寸；nativeImage 自動處理 hi-DPI
  let icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip('海鸚泡芙 PuffinPuff（背景運作中）');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示主視窗',
      click: showMainWindow
    },
    { type: 'separator' },
    {
      label: '✨ 發布',
      click: () => navigateAndShow('publish')
    },
    {
      label: '📅 排程',
      click: () => navigateAndShow('schedule')
    },
    {
      label: '🕒 歷史',
      click: () => navigateAndShow('history')
    },
    {
      label: '👤 帳號',
      click: () => navigateAndShow('accounts')
    },
    {
      label: '⚙️ 設定',
      click: () => navigateAndShow('settings')
    },
    { type: 'separator' },
    {
      label: '完全結束 PuffinPuff',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 左鍵點圖示 → 顯示主視窗
  tray.on('click', showMainWindow);
  // 雙擊也顯示
  tray.on('double-click', showMainWindow);
}

app.whenReady().then(async () => {
  setupNotificationIdentity();

  const userDataPath = app.getPath('userData');
  console.log(`[app] PuffinPuff ${app.getVersion()} started`);
  console.log(`[app] user data folder: ${userDataPath}`);
  console.log(`[app]   ↳ puffinpuff.db, thumbs/, bin/cloudflared.exe`);
  console.log(`[app]   ↳ 升級/重裝不會清掉這些資料`);

  protocol.handle('puffin-media', (req) => {
    const url = new URL(req.url);
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  Menu.setApplicationMenu(buildApplicationMenu());

  await initDatabase();

  // === v0.3.3：AutoLaunch 永遠 ON（除非按「永久停用」）===
  // 邏輯：
  //   - 若 user 已勾「永久停用此保護」(`.autolaunch_permanently_disabled` 標記存在) → 完全不干涉
  //   - 否則：
  //     - 若 autoLaunch 目前 OFF → 自動重新打開
  //     - 首次啟動（無 `.first_run_done` 標記）：跳系統通知告知
  //     - 非首次啟動：靜默修復，不跳通知（避免每次開機都打擾）
  //   - 標記 `.first_run_done` 一定建立（首次完跑一次邏輯後就建立）
  try {
    const permanentlyDisabled = isAutoLaunchPermanentlyDisabled();
    if (permanentlyDisabled) {
      console.log('[app] autoLaunch permanently disabled by user; skipping auto-enable');
    } else {
      const firstRunMarker = join(userDataPath, '.first_run_done');
      const isFirstRun = !fsExistsSync(firstRunMarker);
      const currentlyEnabled = isAutoLaunchEnabled();
      if (!currentlyEnabled) {
        console.log(
          `[app] autoLaunch is OFF, re-enabling (firstRun=${isFirstRun})`
        );
        setAutoLaunch(true);
        if (isFirstRun) {
          notifySimple(
            'PuffinPuff 排程容錯已啟用',
            '電腦開機時會自動啟動 PuffinPuff 接管排程。如要永久關閉請至「設定」→「排程容錯」→ 勾「永久停用此保護」。'
          );
        } else {
          // 不跳系統通知，避免每次開機打擾；只 log
          console.log('[app] silently re-enabled autoLaunch (user had it off but no permanent-disable marker)');
        }
      }
      if (isFirstRun) {
        fsWriteFileSync(
          firstRunMarker,
          JSON.stringify({ enabledAt: Date.now(), version: app.getVersion() }, null, 2),
          'utf-8'
        );
      }
    }
  } catch (e) {
    console.warn('[app] autoLaunch protection logic failed:', e);
  }

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:ping', () => 'pong from main 🐧');
  registerAccountsHandlers();
  registerMediaHandlers();
  registerPublishHandlers();
  registerPostsHandlers();
  registerScheduleHandlers();
  registerSystemHandlers();
  registerWatchersHandlers();
  registerTunnelHandlers();
  registerCredentialsHandlers();
  registerTemplatesHandlers();

  bootstrapSchedulesFromDB();
  startAllWatchers(); // v0.4.1：監聽資料夾

  // 啟動時做一次快取 GC（不阻塞，背景跑）
  // 30 天沒被讀取的轉檔暫存 / 90 天沒讀取的縮圖會自動清掉
  setImmediate(() => {
    try {
      runCacheGc();
    } catch (e) {
      console.warn('[app] cache gc failed:', e);
    }
  });

  // 啟動 Meta long-lived user token 自動續期排程（v0.2.5）
  // 每 24h 檢查；< 7 天到期的 user token 自動 fb_exchange_token 換新 60 天 token，
  // 並重抓 /me/accounts 同步所有 FB / IG 帳號的 Page token
  startMetaTokenRefreshSchedule();

  createTray();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else showMainWindow();
  });
});

// 視窗全關時不結束 App（讓 tray 維持背景運作）
// 真正結束由 tray menu「完全結束」觸發
app.on('window-all-closed', () => {
  // macOS 慣例維持背景；Windows / Linux 也維持，靠 tray 才結束
  // 不呼叫 app.quit() → 維持背景
});

// 真正結束時清資源
app.on('before-quit', () => {
  isQuitting = true;
  shutdownScheduler();
  stopMetaTokenRefreshSchedule();
  stopAllWatchers();
  closeDatabase();
  // v0.8.0：關掉 named tunnel singleton（常駐 cloudflared + server）
  void import('./lib/tunnel').then((m) => m.shutdownNamedTunnelSingleton()).catch(() => {});
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
});
