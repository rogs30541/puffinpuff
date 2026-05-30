/**
 * v0.4.1：監聽資料夾 IPC
 */
import { dialog, ipcMain, BrowserWindow } from 'electron';
import {
  listWatchedFolders,
  createWatchedFolder,
  updateWatchedFolder,
  deleteWatchedFolder
} from '../lib/watchedFoldersRepo';
import { restartWatcher, startAllWatchers, stopAllWatchers } from '../lib/folderWatcher';
import type {
  CreateWatchedFolderInput,
  UpdateWatchedFolderInput,
  WatchedFolder
} from '../../shared/types';

export function registerWatchersHandlers(): void {
  ipcMain.handle('watchers:list', (): WatchedFolder[] => listWatchedFolders());

  ipcMain.handle(
    'watchers:create',
    (_event, input: CreateWatchedFolderInput): number => {
      const id = createWatchedFolder(input);
      restartWatcher(id); // 立刻啟動
      return id;
    }
  );

  ipcMain.handle(
    'watchers:update',
    (_event, input: UpdateWatchedFolderInput): boolean => {
      const ok = updateWatchedFolder(input);
      if (ok) restartWatcher(input.id);
      return ok;
    }
  );

  ipcMain.handle('watchers:delete', (_event, id: number): boolean => {
    deleteWatchedFolder(id);
    // 簡單做法：重啟所有 watchers
    stopAllWatchers();
    startAllWatchers();
    return true;
  });

  ipcMain.handle('watchers:pickFolder', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win ?? new BrowserWindow(), {
      title: '選擇要監聽的資料夾',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
