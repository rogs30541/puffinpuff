import { execute, insertAndGetId, query, queryOne } from './database';
import type {
  PostRecord,
  PostStatus,
  PostTargetRecord,
  PublishContent,
  TargetStatus
} from '../../shared/types';

interface PostRow {
  id: number;
  title: string;
  description: string | null;
  hashtags: string | null;
  privacy: string | null;
  file_path: string | null;
  file_name: string | null;
  thumbnail_path: string | null;
  content_json: string | null;
  status: PostStatus;
  job_id: string | null;
  scheduled_at: number | null;
  post_type: string | null;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
}

interface TargetRow {
  id: number;
  post_id: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  account_id: number | null;
  account_name: string | null;
  status: TargetStatus;
  remote_id: string | null;
  remote_url: string | null;
  error_message: string | null;
  finished_at: number | null;
  views: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  reach: number | null;
  stats_fetched_at: number | null;
  stats_error: string | null;
}

function toTarget(row: TargetRow): PostTargetRecord {
  return {
    id: row.id,
    platform: row.platform,
    accountId: row.account_id,
    accountName: row.account_name ?? '',
    status: row.status,
    remoteId: row.remote_id,
    remoteUrl: row.remote_url,
    errorMessage: row.error_message,
    finishedAt: row.finished_at,
    views: row.views,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    sharesCount: row.shares_count,
    reach: row.reach,
    statsFetchedAt: row.stats_fetched_at,
    statsError: row.stats_error
  };
}

function toPost(row: PostRow, targets: PostTargetRecord[]): PostRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    hashtags: row.hashtags ?? '',
    privacy: row.privacy,
    filePath: row.file_path,
    fileName: row.file_name,
    thumbnailPath: row.thumbnail_path,
    contentJson: row.content_json,
    status: row.status,
    jobId: row.job_id,
    scheduledAt: row.scheduled_at,
    postType: (row.post_type as 'video' | 'image' | 'carousel') ?? 'video',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    targets
  };
}

function loadTargetsForPost(postId: number): PostTargetRecord[] {
  const rows = query<TargetRow>(
    'SELECT * FROM post_targets WHERE post_id = ? ORDER BY id ASC',
    [postId]
  );
  return rows.map(toTarget);
}

export interface CreatePostInput {
  title: string;
  description?: string;
  hashtags?: string;
  privacy?: string;
  filePath: string | null;
  fileName: string | null;
  thumbnailPath?: string | null;
  content: PublishContent;
  status: PostStatus;
  jobId?: string | null;
  scheduledAt?: number | null;
  /** v0.3.0：'video' (default) or 'image' */
  postType?: 'video' | 'image' | 'carousel';
}

export function createPost(input: CreatePostInput): number {
  const now = Date.now();
  return insertAndGetId(
    `INSERT INTO posts (
      title, description, hashtags, privacy, file_path, file_name,
      thumbnail_path, content_json, status, job_id, scheduled_at,
      post_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.description ?? '',
      input.hashtags ?? '',
      input.privacy ?? null,
      input.filePath,
      input.fileName,
      input.thumbnailPath ?? null,
      JSON.stringify(input.content),
      input.status,
      input.jobId ?? null,
      input.scheduledAt ?? null,
      input.postType ?? 'video',
      now,
      now
    ]
  );
}

export function listScheduledPosts(): PostRecord[] {
  const rows = query<PostRow>(
    "SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC"
  );
  return rows.map((row) => toPost(row, loadTargetsForPost(row.id)));
}

/** 找出狀態為 publishing 但已經卡在那超過 N 分鐘的紀錄（App 上次崩潰或被強制關掉留下的）*/
export function listStuckPublishingPosts(staleMinutes = 30): PostRecord[] {
  const threshold = Date.now() - staleMinutes * 60 * 1000;
  const rows = query<PostRow>(
    "SELECT * FROM posts WHERE status = 'publishing' AND updated_at < ? ORDER BY updated_at DESC",
    [threshold]
  );
  return rows.map((row) => toPost(row, loadTargetsForPost(row.id)));
}

/** 把卡死的 publishing 紀錄標 failed，target 中尚未完成的也標 failed */
export function recoverStuckPost(postId: number): void {
  const targets = loadTargetsForPost(postId);
  for (const t of targets) {
    if (t.status === 'pending') {
      execute(
        `UPDATE post_targets SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`,
        ['App 在發布中意外結束，已標記為失敗', Date.now(), t.id]
      );
    }
  }
  updatePostStatus(postId, 'failed', Date.now());
}

export function updatePostStatus(
  postId: number,
  status: PostStatus,
  finishedAt?: number | null
): void {
  execute(
    `UPDATE posts SET status = ?, updated_at = ?, finished_at = ? WHERE id = ?`,
    [status, Date.now(), finishedAt ?? null, postId]
  );
}

export interface CreateTargetInput {
  postId: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  accountId: number | null;
  accountName: string;
  status: TargetStatus;
}

export function createTarget(input: CreateTargetInput): number {
  return insertAndGetId(
    `INSERT OR REPLACE INTO post_targets (
      post_id, platform, account_id, account_name, status
    ) VALUES (?, ?, ?, ?, ?)`,
    [input.postId, input.platform, input.accountId, input.accountName, input.status]
  );
}

export interface UpdateTargetInput {
  postId: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  status: TargetStatus;
  remoteId?: string | null;
  remoteUrl?: string | null;
  errorMessage?: string | null;
}

export function updateTarget(input: UpdateTargetInput): void {
  const isFinal =
    input.status === 'success' || input.status === 'failed' || input.status === 'cancelled';
  execute(
    `UPDATE post_targets SET
      status = ?,
      remote_id = COALESCE(?, remote_id),
      remote_url = COALESCE(?, remote_url),
      error_message = ?,
      finished_at = ?
    WHERE post_id = ? AND platform = ?`,
    [
      input.status,
      input.remoteId ?? null,
      input.remoteUrl ?? null,
      input.errorMessage ?? null,
      isFinal ? Date.now() : null,
      input.postId,
      input.platform
    ]
  );
}

export function listPosts(filter?: { status?: PostStatus | 'all' }): PostRecord[] {
  let sql = `SELECT * FROM posts ORDER BY created_at DESC LIMIT 200`;
  const params: unknown[] = [];
  if (filter?.status && filter.status !== 'all') {
    sql = `SELECT * FROM posts WHERE status = ? ORDER BY created_at DESC LIMIT 200`;
    params.push(filter.status);
  }
  const rows = query<PostRow>(sql, params);
  return rows.map((row) => toPost(row, loadTargetsForPost(row.id)));
}

export function getPost(id: number): PostRecord | null {
  const row = queryOne<PostRow>('SELECT * FROM posts WHERE id = ?', [id]);
  if (!row) return null;
  return toPost(row, loadTargetsForPost(row.id));
}

export function deletePost(id: number): void {
  // post_targets 透過 FK CASCADE 自動清掉
  execute('DELETE FROM posts WHERE id = ?', [id]);
}

/** v0.4.2：更新 target 的觸及數據 */
export interface UpdateTargetStatsInput {
  postId: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  views?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  sharesCount?: number | null;
  reach?: number | null;
  statsError?: string | null;
}

export function updateTargetStats(input: UpdateTargetStatsInput): void {
  execute(
    `UPDATE post_targets SET
      views = ?,
      likes_count = ?,
      comments_count = ?,
      shares_count = ?,
      reach = ?,
      stats_fetched_at = ?,
      stats_error = ?
    WHERE post_id = ? AND platform = ?`,
    [
      input.views ?? null,
      input.likesCount ?? null,
      input.commentsCount ?? null,
      input.sharesCount ?? null,
      input.reach ?? null,
      Date.now(),
      input.statsError ?? null,
      input.postId,
      input.platform
    ]
  );
}

/** 計算整體 status：所有 target 都 success → completed；部分成功 → partial；全失敗 → failed */
export function deriveOverallStatus(targets: PostTargetRecord[]): PostStatus {
  if (targets.length === 0) return 'failed';
  const success = targets.filter((t) => t.status === 'success').length;
  const finalStates = targets.filter(
    (t) => t.status === 'success' || t.status === 'failed' || t.status === 'cancelled'
  ).length;
  if (finalStates < targets.length) return 'publishing';
  if (success === targets.length) return 'completed';
  if (success === 0) return 'failed';
  return 'partial';
}
