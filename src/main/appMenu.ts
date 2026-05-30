import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, shell } from 'electron';

type NavTarget = 'publish' | 'schedule' | 'history' | 'accounts' | 'templates' | 'settings';

function sendNav(target: NavTarget): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('nav:goto', target);
  }
}

function triggerOpenFile(): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('nav:goto', 'publish');
    win.webContents.send('shortcut:openFile');
  }
}

export function buildApplicationMenu(): Menu {
  const isDev = !app.isPackaged;
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    {
      label: '檔案',
      submenu: [
        {
          label: '開啟檔案…',
          accelerator: 'CommandOrControl+O',
          click: triggerOpenFile
        },
        { type: 'separator' },
        {
          label: '關閉視窗',
          accelerator: 'CommandOrControl+W',
          role: 'close'
        },
        { type: 'separator' },
        isMac ? { role: 'quit', label: '結束 PuffinPuff' } : { role: 'quit', label: '結束' }
      ]
    },
    {
      label: '編輯',
      submenu: [
        { role: 'undo', label: '復原' },
        { role: 'redo', label: '取消復原' },
        { type: 'separator' },
        { role: 'cut', label: '剪下' },
        { role: 'copy', label: '複製' },
        { role: 'paste', label: '貼上' },
        { role: 'pasteAndMatchStyle', label: '貼上並符合樣式' },
        { role: 'delete', label: '刪除' },
        { role: 'selectAll', label: '全選' }
      ]
    },
    {
      label: '導覽',
      submenu: [
        { label: '發布', accelerator: 'CommandOrControl+1', click: () => sendNav('publish') },
        { label: '排程', accelerator: 'CommandOrControl+2', click: () => sendNav('schedule') },
        { label: '歷史', accelerator: 'CommandOrControl+3', click: () => sendNav('history') },
        { label: '帳號', accelerator: 'CommandOrControl+4', click: () => sendNav('accounts') },
        { label: '範本', accelerator: 'CommandOrControl+5', click: () => sendNav('templates') },
        { label: '設定', accelerator: 'CommandOrControl+6', click: () => sendNav('settings') }
      ]
    },
    {
      label: '檢視',
      submenu: [
        { role: 'reload', label: '重新載入', accelerator: 'CommandOrControl+R' },
        { role: 'forceReload', label: '強制重新載入', accelerator: 'CommandOrControl+Shift+R' },
        { type: 'separator' },
        { role: 'resetZoom', label: '原始縮放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切換全螢幕', accelerator: 'F11' },
        ...(isDev
          ? [
              { type: 'separator' as const },
              {
                role: 'toggleDevTools' as const,
                label: '開發者工具',
                accelerator: 'F12'
              }
            ]
          : [])
      ]
    },
    {
      label: '說明',
      submenu: [
        {
          label: '關於海鸚泡芙',
          click: () => {
            const userDataPath = app.getPath('userData');
            dialog.showMessageBox({
              type: 'info',
              title: '關於海鸚泡芙',
              message: '海鸚泡芙 PuffinPuff',
              detail:
                `版本 ${app.getVersion()}\n\n` +
                `撲通一聲，內容飛上三平台。\n\n` +
                `📂 你的資料位置（升級不會清掉）：\n${userDataPath}\n\n` +
                `包含：排程、歷史、帳號 token（DPAPI 加密）、影片縮圖、cloudflared\n\n` +
                `© 2026 VVLEE`,
              buttons: ['確定', '打開資料夾'],
              defaultId: 0
            }).then((result) => {
              if (result.response === 1) {
                shell.openPath(userDataPath);
              }
            });
          }
        },
        {
          label: '開啟資料夾位置',
          accelerator: 'CommandOrControl+Shift+D',
          click: () => {
            shell.openPath(app.getPath('userData'));
          }
        },
        { type: 'separator' },
        {
          label: 'YouTube Data API v3 文件',
          click: () => shell.openExternal('https://developers.google.com/youtube/v3')
        },
        {
          label: 'Meta Graph API 文件',
          click: () => shell.openExternal('https://developers.facebook.com/docs/graph-api')
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
