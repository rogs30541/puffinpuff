import { dialog, ipcMain, BrowserWindow } from 'electron';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import {
  cancelAllScheduledPosts,
  cancelScheduledPost,
  createScheduledPost,
  reschedulePost
} from '../lib/scheduler';
import { listScheduledPosts } from '../lib/postsRepo';
import { createPost } from '../lib/postsRepo';
import { flushDatabase } from '../lib/database';
import { registerPostSchedule } from '../lib/scheduler';
import { scanImagePostsFolder } from '../lib/imagePostsScanner';
import {
  DEFAULT_PUBLISH_CONTENT,
  type BulkScheduleRow,
  type FolderScanResult,
  type FolderVideoFile,
  type ImageFolderScanResult,
  type ImagePostBulkRow,
  type PostRecord,
  type PublishContent,
  type ScheduleArgs
} from '../../shared/types';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi']);

function buildContentFromRow(
  title: string,
  description: string,
  hashtags: string,
  privacy: 'public' | 'private',
  platforms: ('youtube' | 'facebook' | 'instagram')[],
  targetAccounts?: {
    youtube?: number;
    facebook?: number;
    instagram?: number;
  }
): PublishContent {
  return {
    common: { title, description, hashtags, privacy },
    perPlatform: {
      youtube: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.youtube,
        enabled: platforms.includes('youtube'),
        ...(targetAccounts?.youtube ? { accountId: targetAccounts.youtube } : {})
      },
      facebook: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.facebook,
        enabled: platforms.includes('facebook'),
        ...(targetAccounts?.facebook ? { accountId: targetAccounts.facebook } : {})
      },
      instagram: {
        ...DEFAULT_PUBLISH_CONTENT.perPlatform.instagram,
        enabled: platforms.includes('instagram'),
        ...(targetAccounts?.instagram ? { accountId: targetAccounts.instagram } : {})
      }
    }
  };
}

function scanFolderForVideos(inputPath: string): { folderPath: string; files: FolderVideoFile[] } {
  if (!existsSync(inputPath)) {
    throw new Error(`路徑不存在：${inputPath}`);
  }
  const stat = statSync(inputPath);

  // v0.6.2：拖單檔也支援 → 把單檔的「父資料夾」當 folderPath，files 只回該單檔
  if (stat.isFile()) {
    const ext = extname(inputPath).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) {
      throw new Error(`不支援的檔案類型：${ext}（只接 mp4/mov/webm/mkv/m4v/avi）`);
    }
    const folderPath = dirname(inputPath);
    const fileName = basename(inputPath);
    return {
      folderPath,
      files: [{
        path: inputPath,
        name: fileName,
        sizeBytes: stat.size,
        modifiedAt: stat.mtimeMs
      }]
    };
  }

  if (!stat.isDirectory()) {
    throw new Error(`不是檔案或資料夾：${inputPath}`);
  }

  const folderPath = inputPath;
  const entries = readdirSync(folderPath, { withFileTypes: true });
  const videos: FolderVideoFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) continue;

    const fullPath = join(folderPath, entry.name);
    const fileStat = statSync(fullPath);
    videos.push({
      path: fullPath,
      name: entry.name,
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtimeMs
    });
  }

  // 依檔名排序（自然順序）
  videos.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));
  return { folderPath, files: videos };
}

export function registerScheduleHandlers(): void {
  ipcMain.handle('schedule:create', async (_event, args: ScheduleArgs): Promise<number> => {
    return createScheduledPost(args);
  });

  ipcMain.handle('schedule:cancel', async (_event, postId: number): Promise<boolean> => {
    cancelScheduledPost(postId);
    return true;
  });

  ipcMain.handle('schedule:cancelAll', async (): Promise<number> => {
    return cancelAllScheduledPosts();
  });

  ipcMain.handle('schedule:list', (): PostRecord[] => listScheduledPosts());

  ipcMain.handle(
    'schedule:reschedule',
    async (_event, postId: number, scheduledAt: number): Promise<boolean> => {
      reschedulePost(postId, scheduledAt);
      return true;
    }
  );

  ipcMain.handle('schedule:openFolderDialog', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win ?? new BrowserWindow(), {
      title: '選擇影片資料夾',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    'schedule:scanFolder',
    async (_event, folderPath: string): Promise<FolderScanResult> => {
      // v0.6.2：scanFolderForVideos 現在回 { folderPath, files }（支援拖單檔自動 fallback 到父資料夾）
      return scanFolderForVideos(folderPath);
    }
  );

  ipcMain.handle(
    'schedule:bulkCreate',
    async (_event, rows: BulkScheduleRow[]): Promise<number[]> => {
      const ids: number[] = [];
      for (const row of rows) {
        if (row.errors.length > 0) continue;
        const content = buildContentFromRow(
          row.title,
          row.description,
          row.hashtags,
          row.privacy,
          row.platforms,
          row.targetAccounts
        );
        const id = createScheduledPost({
          filePath: row.videoPath,
          fileName: row.videoPath.split(/[\\/]/).pop() ?? 'video.mp4',
          thumbnailPath: null,
          content,
          scheduledAt: row.scheduledAt
        });
        ids.push(id);
      }
      return ids;
    }
  );

  // === v0.3.0：圖文批量排程 ===

  ipcMain.handle(
    'schedule:scanImageFolder',
    async (_event, folderPath: string): Promise<ImageFolderScanResult> => {
      return await scanImagePostsFolder(folderPath);
    }
  );

  ipcMain.handle(
    'schedule:bulkCreateImagePosts',
    async (_event, rows: ImagePostBulkRow[]): Promise<number[]> => {
      const ids: number[] = [];
      for (const row of rows) {
        if (row.errors.length > 0) continue;
        // 構建圖文 PublishContent（只有 FB / IG，沒 YT）
        const content: PublishContent = {
          common: {
            title: '', // 圖文沒有獨立標題，全部塞 caption
            description: row.caption,
            hashtags: row.hashtags,
            privacy: 'public'
          },
          perPlatform: {
            youtube: { ...DEFAULT_PUBLISH_CONTENT.perPlatform.youtube, enabled: false },
            facebook: {
              ...DEFAULT_PUBLISH_CONTENT.perPlatform.facebook,
              enabled: row.platforms.includes('facebook'),
              ...(row.targetAccounts?.facebook ? { accountId: row.targetAccounts.facebook } : {})
            },
            instagram: {
              ...DEFAULT_PUBLISH_CONTENT.perPlatform.instagram,
              enabled: row.platforms.includes('instagram'),
              ...(row.targetAccounts?.instagram ? { accountId: row.targetAccounts.instagram } : {})
            }
          },
          // v0.3.2：carousel 多圖路徑
          ...(row.additionalImagePaths && row.additionalImagePaths.length > 0
            ? { imageCarouselPaths: row.additionalImagePaths }
            : {})
        };
        const postId = createPost({
          title: row.caption.split('\n')[0]?.slice(0, 80) || row.imageName,
          description: row.caption,
          hashtags: row.hashtags,
          privacy: 'public',
          filePath: row.imagePath,
          fileName: row.imageName,
          thumbnailPath: row.imagePath, // 圖檔本身當縮圖
          content,
          status: 'scheduled',
          scheduledAt: row.scheduledAt,
          postType: 'image'
        });
        flushDatabase();
        registerPostSchedule(postId, row.scheduledAt);
        ids.push(postId);
      }
      return ids;
    }
  );
}
