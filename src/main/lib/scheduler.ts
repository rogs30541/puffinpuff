import schedule, { Job } from 'node-schedule';
import { BrowserWindow } from 'electron';
import {
  createPost,
  deletePost,
  getPost,
  listScheduledPosts,
  listStuckPublishingPosts,
  recoverStuckPost,
  updatePostStatus
} from './postsRepo';
import { execute, flushDatabase } from './database';
import { notifyScheduleFired, notifySimple } from './notifyService';
import type { PublishContent, ScheduleArgs } from '../../shared/types';

interface ScheduledEntry {
  postId: number;
  job: Job;
}

const scheduled = new Map<number, ScheduledEntry>();

/** 由 publishHandlers 注入：到時間時呼叫此函式啟動實際發布 */
let triggerPublish: ((args: {
  postId: number;
  filePath: string;
  fileName: string;
  thumbnailPath: string | null;
  content: PublishContent;
  postType?: 'video' | 'image' | 'carousel';
}) => Promise<void>) | null = null;

export function setPublishTrigger(
  fn: (args: {
    postId: number;
    filePath: string;
    fileName: string;
    thumbnailPath: string | null;
    content: PublishContent;
    postType?: 'video' | 'image' | 'carousel';
  }) => Promise<void>
): void {
  triggerPublish = fn;
}

function fireScheduledPost(postId: number): void {
  console.log(`[scheduler] firing post #${postId}`);
  const post = getPost(postId);
  if (!post) {
    console.warn(`[scheduler] post #${postId} not found, skip`);
    scheduled.delete(postId);
    return;
  }
  if (post.status !== 'scheduled' || !post.filePath || !post.contentJson) {
    console.warn(`[scheduler] post #${postId} not eligible (status=${post.status})`);
    return;
  }

  // 通知 renderer 一聲
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('schedule:fired', { postId });
  }

  // Windows 系統通知
  try {
    notifyScheduleFired(post.title);
  } catch (e) {
    console.warn('[scheduler] notify failed:', e);
  }

  if (!triggerPublish) {
    console.error('[scheduler] no publish trigger registered!');
    updatePostStatus(postId, 'failed', Date.now());
    return;
  }

  const content: PublishContent = JSON.parse(post.contentJson);
  triggerPublish({
    postId,
    filePath: post.filePath,
    fileName: post.fileName ?? post.filePath.split(/[\\/]/).pop() ?? 'video.mp4',
    thumbnailPath: post.thumbnailPath,
    content,
    postType: post.postType ?? 'video' // v0.3.0：傳 postType 讓 publisher 分流
  }).catch((e) => {
    console.error(`[scheduler] publish trigger failed for #${postId}:`, e);
    updatePostStatus(postId, 'failed', Date.now());
  });

  scheduled.delete(postId);
}

export function registerPostSchedule(postId: number, scheduledAt: number): void {
  // 如果已經有同個 post 的舊 job，先取消
  const existing = scheduled.get(postId);
  if (existing) {
    existing.job.cancel();
  }

  const fireAt = new Date(scheduledAt);
  // 過去時間 → 立即觸發
  if (fireAt.getTime() <= Date.now()) {
    console.log(`[scheduler] post #${postId} scheduled in past, firing now`);
    setTimeout(() => fireScheduledPost(postId), 100);
    return;
  }

  const job = schedule.scheduleJob(fireAt, () => fireScheduledPost(postId));
  if (!job) {
    console.error(`[scheduler] failed to register job for post #${postId}`);
    return;
  }
  scheduled.set(postId, { postId, job });
  console.log(`[scheduler] registered post #${postId} for ${fireAt.toISOString()}`);
}

export function unregisterPostSchedule(postId: number): void {
  const entry = scheduled.get(postId);
  if (entry) {
    entry.job.cancel();
    scheduled.delete(postId);
    console.log(`[scheduler] unregistered post #${postId}`);
  }
}

/** 過時排程的容忍視窗：晚於排定時間超過這麼久就標 failed 不亂發 */
const STALE_TOLERANCE_HOURS = 6;

/** App 啟動時的恢復流程 */
export function bootstrapSchedulesFromDB(): void {
  // === Step 1：清理「卡在 publishing」的紀錄 ===
  const stuck = listStuckPublishingPosts(30); // 30 分鐘前還沒結束 = 死掉了
  if (stuck.length > 0) {
    console.log(`[scheduler] recovering ${stuck.length} stuck publishing posts`);
    for (const post of stuck) {
      recoverStuckPost(post.id);
    }
    notifySimple(
      'PuffinPuff 偵測到中斷紀錄',
      `${stuck.length} 筆上次發布被意外中斷，已標記為失敗。可至歷史頁查看。`
    );
  }

  // === Step 2：處理 scheduled posts ===
  const posts = listScheduledPosts();
  const now = Date.now();
  const staleThresholdMs = STALE_TOLERANCE_HOURS * 60 * 60 * 1000;
  let registered = 0;
  let fireImmediate = 0;
  let staleFailed = 0;

  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const ageMs = now - post.scheduledAt;

    if (ageMs > staleThresholdMs) {
      // 已過時太久 → 不亂發、標 failed
      updatePostStatus(post.id, 'failed', Date.now());
      staleFailed += 1;
      console.log(
        `[scheduler] post #${post.id} (${post.title}) is ${(ageMs / 3600000).toFixed(1)}h stale, marked failed`
      );
      continue;
    }

    registerPostSchedule(post.id, post.scheduledAt);
    if (post.scheduledAt <= now) fireImmediate += 1;
    else registered += 1;
  }

  flushDatabase(); // 把恢復結果立即落盤

  console.log(
    `[scheduler] bootstrap: ${registered} registered, ${fireImmediate} firing now (missed), ${staleFailed} stale`
  );

  if (fireImmediate > 0) {
    notifySimple(
      'PuffinPuff 排程恢復',
      `${fireImmediate} 筆錯過的排程即將補發；${staleFailed > 0 ? `${staleFailed} 筆過時太久已略過。` : ''}`
    );
  } else if (staleFailed > 0) {
    notifySimple(
      'PuffinPuff 排程清理',
      `${staleFailed} 筆排程晚於排定時間 ${STALE_TOLERANCE_HOURS} 小時以上，已自動標為失敗`
    );
  }
}

export function shutdownScheduler(): void {
  for (const entry of scheduled.values()) {
    entry.job.cancel();
  }
  scheduled.clear();
}

/** 把既有 post 改為 scheduled 狀態，註冊到新時間 */
export function reschedulePost(postId: number, scheduledAt: number): void {
  const post = getPost(postId);
  if (!post) throw new Error(`找不到 post #${postId}`);
  // 改狀態 + 寫 scheduled_at
  // 注意：直接 SQL 更新 status + scheduled_at（postsRepo 沒提供這個動作，直接用 execute）
  // 用 import scheduler 的 createPost 路徑不行（會新建）
  // 改用底層 SQL：
  execute(
    'UPDATE posts SET status = ?, scheduled_at = ?, finished_at = NULL, updated_at = ? WHERE id = ?',
    ['scheduled', scheduledAt, Date.now(), postId]
  );
  flushDatabase();
  // 先取消舊註冊（若有）再註冊新時間
  unregisterPostSchedule(postId);
  registerPostSchedule(postId, scheduledAt);
}

// 建立排程 post（直接寫 DB + 立即落盤 + 註冊到 scheduler）
export function createScheduledPost(args: ScheduleArgs): number {
  const postId = createPost({
    title: args.content.common.title || args.fileName,
    description: args.content.common.description,
    hashtags: args.content.common.hashtags,
    privacy: args.content.common.privacy,
    filePath: args.filePath,
    fileName: args.fileName,
    thumbnailPath: args.thumbnailPath,
    content: args.content,
    status: 'scheduled',
    scheduledAt: args.scheduledAt
  });
  flushDatabase(); // 立刻寫硬碟，避免 500ms debounce 期間 App 被關掉而遺失
  registerPostSchedule(postId, args.scheduledAt);
  return postId;
}

export function cancelScheduledPost(postId: number): void {
  unregisterPostSchedule(postId);
  deletePost(postId);
  flushDatabase();
}

/**
 * 取消所有目前在排程中的 post：
 *  1. 取消 node-schedule job
 *  2. 從 DB 刪除 status='scheduled' 的紀錄
 *  3. 立即落盤
 * 回傳被取消的數量。
 */
export function cancelAllScheduledPosts(): number {
  // 先撈 DB 裡所有 scheduled post（避免只清 in-memory map 而漏掉那些尚未被 scheduler 載入的）
  const posts = listScheduledPosts();
  const ids = posts.map((p) => p.id);

  // 取消所有 in-memory job
  for (const entry of scheduled.values()) {
    entry.job.cancel();
  }
  scheduled.clear();

  // 刪除所有 scheduled post（targets 透過 FK CASCADE 自動清）
  for (const id of ids) {
    try {
      deletePost(id);
    } catch (e) {
      console.warn(`[scheduler] cancelAll: deletePost(${id}) failed:`, e);
    }
  }
  flushDatabase();
  console.log(`[scheduler] cancelAllScheduledPosts: cancelled ${ids.length} posts`);
  return ids.length;
}
