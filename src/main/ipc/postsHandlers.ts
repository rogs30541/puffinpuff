import { basename } from 'node:path';
import { ipcMain } from 'electron';
import {
  createPost,
  deletePost as repoDeletePost,
  getPost,
  listPosts,
  updateTargetStats
} from '../lib/postsRepo';
import { fetchStatsForTarget } from '../lib/statsCollector';
import type { PostRecord, PostStatus, PostTargetRecord, SaveDraftArgs } from '../../shared/types';

export function registerPostsHandlers(): void {
  ipcMain.handle(
    'posts:list',
    (_event, filter?: { status?: PostStatus | 'all' }): PostRecord[] => {
      return listPosts(filter);
    }
  );

  ipcMain.handle('posts:get', (_event, id: number): PostRecord | null => {
    return getPost(id);
  });

  ipcMain.handle('posts:saveDraft', (_event, args: SaveDraftArgs): number => {
    const fileName =
      args.fileName ?? (args.filePath ? basename(args.filePath) : null);
    const postId = createPost({
      title: args.content.common.title || '(未命名草稿)',
      description: args.content.common.description,
      hashtags: args.content.common.hashtags,
      privacy: args.content.common.privacy,
      filePath: args.filePath,
      fileName,
      thumbnailPath: args.thumbnailPath ?? null,
      content: args.content,
      status: 'draft'
    });
    return postId;
  });

  ipcMain.handle('posts:delete', (_event, id: number): boolean => {
    repoDeletePost(id);
    return true;
  });

  // 重發失敗平台先佔位（V1.1 接入完整邏輯，需要額外的 publish:retry 機制）
  ipcMain.handle(
    'posts:retryTarget',
    async (_event, _postId: number, _platform: string): Promise<string> => {
      throw new Error('重發功能尚未實作（V1.1 接入）');
    }
  );

  // v0.4.2：抓取單一 post 所有 target 的觸及數據
  ipcMain.handle(
    'posts:fetchStats',
    async (_event, postId: number): Promise<PostTargetRecord[]> => {
      const post = getPost(postId);
      if (!post) throw new Error(`找不到 post #${postId}`);
      for (const target of post.targets) {
        if (target.status !== 'success' || !target.remoteId || !target.accountId) {
          continue;
        }
        try {
          const stats = await fetchStatsForTarget(target.platform, target.accountId, target.remoteId);
          updateTargetStats({
            postId,
            platform: target.platform,
            views: stats.views,
            likesCount: stats.likesCount,
            commentsCount: stats.commentsCount,
            sharesCount: stats.sharesCount,
            reach: stats.reach,
            statsError: null
          });
        } catch (e) {
          console.warn(`[stats] ${target.platform} ${target.remoteId} fetch failed:`, (e as Error).message);
          updateTargetStats({
            postId,
            platform: target.platform,
            statsError: (e as Error).message.slice(0, 500)
          });
        }
      }
      // 重新讀取最新資料
      const updated = getPost(postId);
      return updated?.targets ?? [];
    }
  );
}
