import { BrowserWindow, ipcMain } from 'electron';
import { randomBytes } from 'node:crypto';
import { basename, extname } from 'node:path';
import { setPublishTrigger } from '../lib/scheduler';
import { notifyPublishComplete } from '../lib/notifyService';
import { probeMedia, validateForPlatforms } from '../lib/mediaProbe';
import { transcodeForSocial } from '../lib/transcoder';
import {
  listAccountsByPlatform,
  type AccountPublic,
  type Platform
} from '../lib/accountsRepo';
import { uploadToYouTube } from '../adapters/youtubeAdapter';
import { uploadToFacebookReels, publishPhotoPost } from '../adapters/facebookAdapter';
import {
  uploadToInstagramReels,
  publishImagePost,
  publishCarouselPost
} from '../adapters/instagramAdapter';
import { uploadToThreads } from '../adapters/threadsAdapter';
import { withRetry } from '../lib/retry';
import { refreshUserTokenForAccount } from '../lib/metaTokenRefresher';
import { isMetaAuthError } from '../lib/metaErrorHelpers';

/** v0.4.4：包裝 Meta adapter call，遇 auth error 自動 refresh + 重試 1 次 */
async function withMetaAuthRetry<T>(
  accountId: number,
  fn: () => Promise<T>,
  platform: 'facebook' | 'instagram'
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (e as any)?.meta;
    const isAuth = meta?.kind === 'auth' || isMetaAuthError(e);
    if (!isAuth) throw e;
    console.warn(`[${platform}] auth error detected, refreshing token then retrying once...`);
    const refreshed = await refreshUserTokenForAccount(accountId);
    if (!refreshed) {
      throw e; // refresh 失敗 → 原錯誤丟出
    }
    // 重試 1 次（adapter 會自動從 DB 重讀新 token）
    return await fn();
  }
}
import {
  createPost,
  createTarget,
  deriveOverallStatus,
  getPost,
  updatePostStatus,
  updateTarget
} from '../lib/postsRepo';
import type {
  CommonContent,
  PlatformOverride,
  PublishJobState,
  PublishPlatformState,
  PublishProgressEvent,
  PublishStartArgs
} from '../../shared/types';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'threads';

interface RunningJob {
  state: PublishJobState;
  cancelRequested: boolean;
  webContents: Electron.WebContents;
  postId: number;
}

const jobs = new Map<string, RunningJob>();

function newJobId(): string {
  return randomBytes(8).toString('hex');
}

function effectiveContent(
  common: CommonContent,
  override: PlatformOverride
): {
  title: string;
  description: string;
  hashtags: string;
  privacy: 'public' | 'private';
} {
  return {
    title: override.title || common.title,
    description: override.description || common.description,
    hashtags: override.hashtags || common.hashtags,
    privacy: override.privacy || common.privacy
  };
}

function emitProgress(job: RunningJob): void {
  const evt: PublishProgressEvent = { jobId: job.state.jobId, state: { ...job.state } };
  if (!job.webContents.isDestroyed()) {
    job.webContents.send('publish:progress', evt);
  }
}

function updatePlatform(
  job: RunningJob,
  platform: PlatformKey,
  patch: Partial<PublishPlatformState>
): void {
  const idx = job.state.platforms.findIndex((p) => p.platform === platform);
  if (idx < 0) return;
  job.state.platforms[idx] = { ...job.state.platforms[idx], ...patch };
  emitProgress(job);

  // 同步寫進 post_targets（status 變更時記錄到資料庫；只記錄非中間 status）
  if (patch.status) {
    const targetStatus =
      patch.status === 'success' ||
      patch.status === 'failed' ||
      patch.status === 'cancelled'
        ? patch.status
        : 'pending';
    try {
      updateTarget({
        postId: job.postId,
        platform,
        status: targetStatus,
        remoteUrl: patch.url ?? null,
        errorMessage: patch.error ?? null
      });
    } catch (e) {
      console.warn('[publish] updateTarget failed:', e);
    }
  }
}

async function runYouTube(
  job: RunningJob,
  filePath: string,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>
): Promise<void> {
  updatePlatform(job, 'youtube', { status: 'uploading', percent: 0 });

  try {
    const result = await withRetry(
      () => uploadToYouTube(
        {
          accountId: account.id,
          filePath,
          title: content.title,
          description: content.description,
          hashtags: content.hashtags,
          privacy: content.privacy === 'private' ? 'private' : 'public'
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'youtube', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      ),
      {
        onRetry: (attempt, err, delay) => {
          updatePlatform(job, 'youtube', {
            status: 'uploading',
            percent: 0,
            error: `重試 ${attempt}/3（${Math.round(delay / 1000)}s 後）：${err.message.slice(0, 80)}`
          });
        }
      }
    );
    updatePlatform(job, 'youtube', {
      status: 'success',
      percent: 100,
      url: result.url
    });
  } catch (e) {
    updatePlatform(job, 'youtube', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

async function runFacebook(
  job: RunningJob,
  filePath: string,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>
): Promise<void> {
  updatePlatform(job, 'facebook', { status: 'uploading', percent: 0 });

  try {
    const result = await withMetaAuthRetry(account.id, () => withRetry(
      () => uploadToFacebookReels(
        {
          accountId: account.id,
          filePath,
          description: [content.title, content.description].filter(Boolean).join('\n\n'),
          hashtags: content.hashtags
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'facebook', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      ),
      {
        onRetry: (attempt, err, delay) => {
          updatePlatform(job, 'facebook', {
            status: 'uploading',
            percent: 0,
            error: `重試 ${attempt}/3（${Math.round(delay / 1000)}s 後）：${err.message.slice(0, 80)}`
          });
        }
      }
    ), 'facebook');
    updatePlatform(job, 'facebook', {
      status: 'success',
      percent: 100,
      url: result.url
    });
  } catch (e) {
    updatePlatform(job, 'facebook', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

async function runInstagram(
  job: RunningJob,
  filePath: string,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>
): Promise<void> {
  updatePlatform(job, 'instagram', { status: 'uploading', percent: 0 });

  try {
    const result = await withMetaAuthRetry(account.id, () => withRetry(
      () => uploadToInstagramReels(
        {
          accountId: account.id,
          filePath,
          caption: [content.title, content.description].filter(Boolean).join('\n\n'),
          hashtags: content.hashtags
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'instagram', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      ),
      {
        onRetry: (attempt, err, delay) => {
          updatePlatform(job, 'instagram', {
            status: 'uploading',
            percent: 0,
            error: `重試 ${attempt}/3（${Math.round(delay / 1000)}s 後）：${err.message.slice(0, 80)}`
          });
        }
      }
    ), 'instagram');
    updatePlatform(job, 'instagram', {
      status: 'success',
      percent: 100,
      url: result.url
    });
  } catch (e) {
    updatePlatform(job, 'instagram', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

// v0.3.0：圖文版本（呼叫 photo API 而非 video Reels API）
async function runFacebookPhoto(
  job: RunningJob,
  imagePath: string,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>
): Promise<void> {
  updatePlatform(job, 'facebook', { status: 'uploading', percent: 0 });
  try {
    const result = await publishPhotoPost(
      {
        accountId: account.id,
        imagePath,
        caption: [content.title, content.description].filter(Boolean).join('\n\n'),
        hashtags: content.hashtags
      },
      (e) => {
        if (job.cancelRequested) return;
        updatePlatform(job, 'facebook', {
          percent: e.percent,
          bytesUploaded: e.bytesUploaded,
          totalBytes: e.totalBytes
        });
      }
    );
    updatePlatform(job, 'facebook', {
      status: 'success',
      percent: 100,
      url: result.url
    });
  } catch (e) {
    updatePlatform(job, 'facebook', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

async function runInstagramImage(
  job: RunningJob,
  imagePath: string,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>,
  additionalImagePaths?: string[]
): Promise<void> {
  updatePlatform(job, 'instagram', { status: 'uploading', percent: 0 });
  const allImagePaths = additionalImagePaths && additionalImagePaths.length > 0
    ? [imagePath, ...additionalImagePaths]
    : [imagePath];
  const isCarousel = allImagePaths.length >= 2;
  try {
    const caption = [content.title, content.description].filter(Boolean).join('\n\n');
    if (isCarousel) {
      // v0.3.2：carousel（2-10 張）
      const result = await publishCarouselPost(
        {
          accountId: account.id,
          imagePaths: allImagePaths,
          caption,
          hashtags: content.hashtags
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'instagram', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      );
      updatePlatform(job, 'instagram', {
        status: 'success',
        percent: 100,
        url: result.url
      });
    } else {
      const result = await publishImagePost(
        {
          accountId: account.id,
          imagePath,
          caption,
          hashtags: content.hashtags
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'instagram', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      );
      updatePlatform(job, 'instagram', {
        status: 'success',
        percent: 100,
        url: result.url
      });
    }
  } catch (e) {
    updatePlatform(job, 'instagram', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

// v0.7.0：Threads — VIDEO / IMAGE / TEXT
async function runThreads(
  job: RunningJob,
  filePath: string | null,
  account: AccountPublic,
  content: ReturnType<typeof effectiveContent>,
  postType: 'video' | 'image' | 'carousel'
): Promise<void> {
  updatePlatform(job, 'threads', { status: 'uploading', percent: 0 });

  // Threads 不支援 carousel（截至 v1.0，多圖貼文 API 尚未開放給第三方）
  //   → carousel 模式下，只發第一張當 IMAGE，並在 description 提示
  const text = [content.title, content.description, content.hashtags]
    .filter(Boolean)
    .join('\n\n');
  const usingMedia = postType !== 'carousel' || filePath !== null;

  try {
    const result = await withRetry(
      () => uploadToThreads(
        {
          accountId: account.id,
          text,
          videoPath: postType === 'video' && filePath ? filePath : undefined,
          imagePath: (postType === 'image' || postType === 'carousel') && filePath ? filePath : undefined
        },
        (e) => {
          if (job.cancelRequested) return;
          updatePlatform(job, 'threads', {
            percent: e.percent,
            bytesUploaded: e.bytesUploaded,
            totalBytes: e.totalBytes
          });
        }
      ),
      {
        onRetry: (attempt, err, delay) => {
          updatePlatform(job, 'threads', {
            status: 'uploading',
            percent: 0,
            error: `重試 ${attempt}/3（${Math.round(delay / 1000)}s 後）：${err.message.slice(0, 80)}`
          });
        }
      }
    );
    updatePlatform(job, 'threads', {
      status: 'success',
      percent: 100,
      url: result.url
    });
    // 觸發未用變數警告壓制（usingMedia 暫保留給未來 TEXT-only 條件分支）
    void usingMedia;
  } catch (e) {
    updatePlatform(job, 'threads', {
      status: 'failed',
      error: (e as Error).message
    });
    throw e;
  }
}

function runUnimplemented(job: RunningJob, platform: PlatformKey): void {
  updatePlatform(job, platform, {
    status: 'failed',
    error: `${platform.toUpperCase()} 上傳功能尚未實作（V1.0 下個版本接入）`
  });
}

/**
 * 啟動發布工作（核心邏輯，可被 IPC handler 或 scheduler trigger 呼叫）
 * @param existingPostId 若提供，則不建立新 post（用於排程觸發場景）
 */
function startPublishJob(
  args: PublishStartArgs,
  webContents: Electron.WebContents,
  existingPostId?: number
): string {
  const jobId = newJobId();

  // v0.6.0：入口處自動偵測 mode（避免 caller 傳錯 postType 把圖檔送進 Reels API）
  // 規則：
  //   1. 副檔名是圖 → 強制 image / carousel（依 imageCarouselPaths 長度）
  //   2. 副檔名是影 → 強制 video
  //   3. 未知 → fallback 用 caller 傳的 postType（預設 video）
  const ext = (args.filePath ?? '').toLowerCase().split('.').pop() ?? '';
  const isImageFile = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext);
  const isVideoFile = ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(ext);
  const carouselPaths = args.content?.imageCarouselPaths ?? [];

  let postType: 'video' | 'image' | 'carousel';
  if (isImageFile) {
    postType = carouselPaths.length >= 1 ? 'carousel' : 'image';
  } else if (isVideoFile) {
    postType = 'video';
  } else {
    postType = (args.postType as 'video' | 'image' | 'carousel') ?? 'video';
  }

  if (postType !== (args.postType ?? 'video')) {
    console.warn(
      `[publish] postType auto-corrected: caller said "${args.postType ?? 'video'}" but file is ${ext} → using "${postType}"`
    );
  }

  const platforms: PlatformKey[] = [];
  const platformStates: PublishPlatformState[] = [];

  // v0.6.0：YT 只接 video；image / carousel 都排除 YT
  // v0.7.0：Threads 三種 postType 都支援（TEXT/IMAGE/VIDEO）
  const candidatePlatforms = postType === 'video'
    ? (['youtube', 'facebook', 'instagram', 'threads'] as const)
    : (['facebook', 'instagram', 'threads'] as const);

  // 為每個啟用平台選定要發布的帳號
  // 優先順序：override.accountId（使用者指定）> 該平台第一個連線帳號
  for (const platform of candidatePlatforms) {
    const override = args.content.perPlatform[platform];
    if (!override.enabled) continue;
    const accounts = listAccountsByPlatform(platform as Platform);
    if (accounts.length === 0) {
      platformStates.push({
        platform,
        accountId: -1,
        accountName: '(未連線)',
        status: 'failed',
        percent: 0,
        error: `未連線 ${platform} 帳號`
      });
      continue;
    }
    const account =
      (override.accountId !== undefined &&
        accounts.find((a) => a.id === override.accountId)) ||
      accounts[0];
    platforms.push(platform);
    platformStates.push({
      platform,
      accountId: account.id,
      accountName: account.displayName,
      status: 'pending',
      percent: 0
    });
  }

  const state: PublishJobState = {
    jobId,
    filePath: args.filePath,
    platforms: platformStates,
    overallStatus: 'running',
    startedAt: Date.now()
  };

  // 建立或更新 post + targets
  const postId = existingPostId ?? createPost({
    title: args.content.common.title || basename(args.filePath, extname(args.filePath)),
    description: args.content.common.description,
    hashtags: args.content.common.hashtags,
    privacy: args.content.common.privacy,
    filePath: args.filePath,
    fileName: args.fileName ?? basename(args.filePath),
    thumbnailPath: args.thumbnailPath ?? null,
    content: args.content,
    status: 'publishing',
    jobId,
    postType
  });

  // 排程觸發場景：把 post 從 scheduled → publishing
  if (existingPostId !== undefined) {
    updatePostStatus(postId, 'publishing');
  }

      for (const ps of platformStates) {
        createTarget({
          postId,
          platform: ps.platform,
          accountId: ps.accountId >= 0 ? ps.accountId : null,
          accountName: ps.accountName,
          status: ps.status === 'failed' ? 'failed' : 'pending'
        });
        if (ps.status === 'failed') {
          updateTarget({
            postId,
            platform: ps.platform,
            status: 'failed',
            errorMessage: ps.error ?? null
          });
        }
      }

      const job: RunningJob = {
        state,
        cancelRequested: false,
        webContents,
        postId
      };
      jobs.set(jobId, job);

      // 立刻發第一次進度（讓 UI 顯示佔位）
      emitProgress(job);

      // 非同步執行各平台上傳（不等 await，立即回 jobId 給 renderer）
      (async () => {
        // ===== 預處理階段：自動轉檔（圖文模式跳過）=====
        let uploadPath = args.filePath;
        if (postType === 'video') {
          try {
            const spec = await probeMedia(args.filePath);
            if (spec.type === 'video') {
              const validations = validateForPlatforms(spec);
              const enabledPlatforms = new Set(platforms);
              const needsTranscode = validations.some(
                (v) => enabledPlatforms.has(v.platform) && v.needsTranscode
              );

              if (needsTranscode) {
                console.log(`[publish] needs transcode for ${args.filePath}`);
                job.state.transcoding = {
                  inputPath: args.filePath,
                  percent: 0,
                  currentSec: 0,
                  durationSec: spec.durationSec
                };
                emitProgress(job);

                uploadPath = await transcodeForSocial({
                  inputPath: args.filePath,
                  durationSec: spec.durationSec,
                  onProgress: (e) => {
                    if (job.cancelRequested) return;
                    job.state.transcoding = {
                      inputPath: args.filePath,
                      outputPath: uploadPath,
                      percent: e.percent,
                      currentSec: e.currentSec,
                      durationSec: e.totalSec
                    };
                    emitProgress(job);
                  }
                });
                console.log(`[publish] transcoded → ${uploadPath}`);
                job.state.transcoding = undefined;
                emitProgress(job);
              }
            }
          } catch (e) {
            console.error('[publish] preprocessing failed:', e);
            // 轉檔失敗 → 略過轉檔，用原檔上傳（讓使用者看到平台層的錯誤訊息）
            job.state.transcoding = undefined;
            emitProgress(job);
          }
        }

        const results: Promise<void>[] = [];
        for (const platform of platforms) {
          if (job.cancelRequested) {
            updatePlatform(job, platform, { status: 'cancelled' });
            continue;
          }
          const accountState = job.state.platforms.find((p) => p.platform === platform);
          if (!accountState) continue;
          const accounts = listAccountsByPlatform(platform as Platform);
          const account = accounts.find((a) => a.id === accountState.accountId);
          if (!account) {
            updatePlatform(job, platform, { status: 'failed', error: '帳號已不存在' });
            continue;
          }
          const content = effectiveContent(args.content.common, args.content.perPlatform[platform]);

          if (platform === 'youtube') {
            const ytOverride = args.content.perPlatform.youtube;
            const ytContent = ytOverride.useNativeDefaults
              ? {
                  title: basename(args.filePath, extname(args.filePath)).slice(0, 100),
                  description: '',
                  hashtags: '',
                  privacy: 'private' as const
                }
              : content;
            results.push(
              runYouTube(job, uploadPath, account, ytContent).catch(() => {
                /* 狀態已在 runYouTube 內部更新 */
              })
            );
          } else if (platform === 'facebook') {
            // v0.6.0：tri-state mode
            //   video → Reels API；image / carousel → photo API（FB photo API 自動處理單/多圖）
            const fbRun = postType === 'video'
              ? runFacebook(job, uploadPath, account, content)
              : runFacebookPhoto(job, uploadPath, account, content);
            results.push(fbRun.catch(() => { /* 內部已更新 */ }));
          } else if (platform === 'instagram') {
            // v0.6.0：tri-state mode
            //   video → Reels API；image → 單圖 API；carousel → carousel API
            let igRun: Promise<void>;
            if (postType === 'video') {
              igRun = runInstagram(job, uploadPath, account, content);
            } else if (postType === 'carousel') {
              igRun = runInstagramImage(job, uploadPath, account, content, args.content.imageCarouselPaths);
            } else {
              // image：強制 carouselPaths=undefined，確保走單圖路徑
              igRun = runInstagramImage(job, uploadPath, account, content, undefined);
            }
            results.push(igRun.catch(() => { /* 內部已更新 */ }));
          } else if (platform === 'threads') {
            // v0.7.0：Threads — video / image / carousel 都走 runThreads
            const thRun = runThreads(job, uploadPath, account, content, postType);
            results.push(thRun.catch(() => { /* 內部已更新 */ }));
          } else {
            runUnimplemented(job, platform);
          }
        }

        await Promise.allSettled(results);

        // 判斷整體狀態
        const allSuccess = job.state.platforms.every(
          (p) => p.status === 'success' || p.status === 'cancelled'
        );
        const anySuccess = job.state.platforms.some((p) => p.status === 'success');
        job.state.overallStatus = job.cancelRequested
          ? 'cancelled'
          : allSuccess
            ? 'done'
            : anySuccess
              ? 'done'
              : 'failed';
        job.state.finishedAt = Date.now();
        emitProgress(job);

        // 寫入 posts 最終狀態 — 從 DB 重新讀所有 targets 來算（重發場景才正確）
        try {
          const fullPost = getPost(job.postId);
          if (fullPost) {
            const overall = deriveOverallStatus(fullPost.targets);
            updatePostStatus(job.postId, overall, Date.now());
          }
        } catch (e) {
          console.warn('[publish] updatePostStatus failed:', e);
        }

        // Windows 系統通知
        try {
          const succeededPlatforms = job.state.platforms
            .filter((p) => p.status === 'success')
            .map((p) => p.platform.toUpperCase());
          const failedPlatforms = job.state.platforms
            .filter((p) => p.status === 'failed')
            .map((p) => p.platform.toUpperCase());
          const firstSuccess = job.state.platforms.find((p) => p.status === 'success');
          notifyPublishComplete({
            postTitle: args.content.common.title || basename(args.filePath, extname(args.filePath)),
            successPlatforms: succeededPlatforms,
            failedPlatforms: failedPlatforms,
            firstSuccessUrl: firstSuccess?.url
          });
        } catch (e) {
          console.warn('[publish] notify failed:', e);
        }
      })().catch((e) => {
        console.error('[publish] job runtime error:', e);
      });

  return jobId;
}

/**
 * 重新發布既有 post：只針對 status='failed' 的平台重試，成功的不動
 * @param mode 'failedOnly' = 只重試失敗的；'all' = 全部重新發
 */
export function republishExistingPost(
  postId: number,
  webContents: Electron.WebContents,
  mode: 'failedOnly' | 'all' = 'failedOnly'
): string {
  const post = getPost(postId);
  if (!post) throw new Error(`找不到 post #${postId}`);
  if (!post.filePath || !post.contentJson) {
    throw new Error('post 沒有檔案路徑或內容資料，無法重發');
  }

  const fullContent = JSON.parse(post.contentJson);

  if (mode === 'failedOnly') {
    // 把 success 的平台 enabled=false，避免重複發布
    const successfulPlatforms = new Set(
      post.targets.filter((t) => t.status === 'success').map((t) => t.platform)
    );
    for (const p of ['youtube', 'facebook', 'instagram', 'threads'] as const) {
      if (successfulPlatforms.has(p)) {
        fullContent.perPlatform[p].enabled = false;
      }
    }
  }

  return startPublishJob(
    {
      filePath: post.filePath,
      fileName: post.fileName ?? undefined,
      thumbnailPath: post.thumbnailPath,
      content: fullContent
    },
    webContents,
    postId
  );
}

export function registerPublishHandlers(): void {
  ipcMain.handle(
    'publish:start',
    async (event, args: PublishStartArgs): Promise<string> => {
      return startPublishJob(args, event.sender);
    }
  );

  ipcMain.handle(
    'publish:republish',
    async (event, postId: number, mode: 'failedOnly' | 'all' = 'failedOnly'): Promise<string> => {
      return republishExistingPost(postId, event.sender, mode);
    }
  );

  ipcMain.handle('publish:cancel', (_event, jobId: string): boolean => {
    const job = jobs.get(jobId);
    if (!job) return false;
    job.cancelRequested = true;
    return true;
  });

  // 註冊給 scheduler 用的 publish trigger
  setPublishTrigger(async ({ postId, filePath, fileName, thumbnailPath, content, postType }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.isDestroyed()) {
      console.warn('[publish] scheduler triggered but no window available');
      return;
    }
    startPublishJob(
      { filePath, fileName, thumbnailPath, content, postType },
      win.webContents,
      postId
    );
  });
}

export function getRunningJobs(): PublishJobState[] {
  return Array.from(jobs.values()).map((j) => j.state);
}
