import { app } from 'electron';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const HIDDEN_LAUNCH_ARG = '--auto-launched';
const PERMANENT_DISABLE_MARKER = '.autolaunch_permanently_disabled';

function markerPath(): string {
  return join(app.getPath('userData'), PERMANENT_DISABLE_MARKER);
}

/** 取得當前「電腦開機自動啟動」狀態 */
export function isAutoLaunchEnabled(): boolean {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return false;
  }
  const settings = app.getLoginItemSettings({
    args: [HIDDEN_LAUNCH_ARG]
  });
  return settings.openAtLogin;
}

/** 設定「電腦開機自動啟動」狀態 */
export function setAutoLaunch(enabled: boolean): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return; // Linux 走另一套，本 V1 不處理
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: [HIDDEN_LAUNCH_ARG]
  });
}

/** 判斷本次啟動是否由開機自啟觸發（之後可決定要不要靜默） */
export function wasLaunchedOnStartup(): boolean {
  return process.argv.includes(HIDDEN_LAUNCH_ARG);
}

/**
 * v0.3.3：是否「永久停用此保護」？
 * - true → boot 時跳過自動重新啟用邏輯
 * - false → boot 時若 autoLaunch OFF，會自動重新打開（保護排程）
 */
export function isAutoLaunchPermanentlyDisabled(): boolean {
  return existsSync(markerPath());
}

export function setAutoLaunchPermanentlyDisabled(value: boolean): void {
  const path = markerPath();
  if (value) {
    try {
      writeFileSync(
        path,
        JSON.stringify({ disabledAt: Date.now(), version: app.getVersion() }, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.warn('[autoLaunch] write permanent disable marker failed:', e);
    }
    // 同時關掉開機啟動
    setAutoLaunch(false);
  } else {
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch (e) {
      console.warn('[autoLaunch] remove permanent disable marker failed:', e);
    }
  }
}
