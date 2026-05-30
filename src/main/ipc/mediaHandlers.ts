import { BrowserWindow, dialog, ipcMain } from 'electron';
import { probeMedia, validateForPlatforms, type MediaSpec, type PlatformValidation } from '../lib/mediaProbe';
import { generateThumbnail } from '../lib/thumbnailer';

export interface ProbedMedia {
  spec: MediaSpec;
  thumbnailPath: string | null;
  validations: PlatformValidation[];
}

export function registerMediaHandlers(): void {
  ipcMain.handle('media:openFileDialog', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win ?? new BrowserWindow(), {
      title: '選擇影片或圖片',
      properties: ['openFile'],
      filters: [
        { name: '影片', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
        { name: '圖片', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: '所有檔案', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('media:probe', async (_event, filePath: string): Promise<ProbedMedia> => {
    const spec = await probeMedia(filePath);
    const validations = validateForPlatforms(spec);

    let thumbnailPath: string | null = null;
    if (spec.type === 'video') {
      try {
        // 從影片約 10% 處抓縮圖；極短影片就抓 0.5 秒
        const at = Math.min(spec.durationSec * 0.1, Math.max(0.5, spec.durationSec - 0.1));
        thumbnailPath = await generateThumbnail(spec.filePath, at);
      } catch (e) {
        console.warn('[thumbnail] failed:', e);
      }
    }

    return { spec, thumbnailPath, validations };
  });
}
