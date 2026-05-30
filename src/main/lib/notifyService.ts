import { app, BrowserWindow, Notification, shell } from 'electron';

/**
 * 取得當前主視窗（用於通知點擊時聚焦回 App）
 */
function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

/** App 啟動時設定 AppUserModelId，讓 Windows 通知歸屬 PuffinPuff */
export function setupNotificationIdentity(): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId('tw.vvlee.puffinpuff');
  }
}

interface PublishCompleteArgs {
  postTitle: string;
  successPlatforms: string[];
  failedPlatforms: string[];
  /** 第一個成功平台的 URL，點通知會用瀏覽器打開 */
  firstSuccessUrl?: string;
}

export function notifyPublishComplete(args: PublishCompleteArgs): void {
  if (!Notification.isSupported()) return;

  const success = args.successPlatforms.length;
  const failed = args.failedPlatforms.length;

  let title: string;
  let body: string;

  if (failed === 0 && success > 0) {
    title = '✅ 全部發布成功';
    body = `${args.postTitle} → ${args.successPlatforms.join('、')}`;
  } else if (success === 0) {
    title = '⚠ 發布全部失敗';
    body = `${args.postTitle} → ${args.failedPlatforms.join('、')} 都失敗，點此查看詳情`;
  } else {
    title = '🟡 部分成功';
    body = `${args.postTitle} → 成功 ${args.successPlatforms.join('、')}；失敗 ${args.failedPlatforms.join('、')}`;
  }

  const notif = new Notification({
    title,
    body,
    silent: false
  });

  notif.on('click', () => {
    focusMainWindow();
    if (args.firstSuccessUrl) {
      // 同時用系統瀏覽器打開影片
      shell.openExternal(args.firstSuccessUrl).catch(() => {});
    }
  });

  notif.show();
}

export function notifyScheduleFired(postTitle: string): void {
  if (!Notification.isSupported()) return;

  const notif = new Notification({
    title: '⏰ 排程觸發',
    body: `「${postTitle}」開始發布`,
    silent: true
  });
  notif.on('click', focusMainWindow);
  notif.show();
}

export function notifySimple(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const notif = new Notification({ title, body });
  notif.on('click', focusMainWindow);
  notif.show();
}
