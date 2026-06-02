export type Platform = 'youtube' | 'facebook' | 'instagram' | 'threads' | 'tiktok';

/**
 * v0.7.3 Feature flags — UI 顯露控制（底層 code 不動，純 UI 開關）
 *
 *  - THREADS_UI_ENABLED：Threads OAuth 在 Dev mode 仍卡在 Meta 端授權鏈
 *    （登入後跳 threads.net 首頁、不出同意頁），暫時關閉 UI 入口避免使用者誤觸。
 *    底層 adapter / IPC / DB schema 保留，未來 Meta App 通過 review 後翻 true 即可。
 */
export const FEATURE_FLAGS = {
  THREADS_UI_ENABLED: false
} as const;

export interface AccountPublic {
  id: number;
  platform: Platform;
  displayName: string;
  externalId: string;
  expiresAt: number | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface MetaConnectResult {
  user: { id: string; name: string };
  facebookAccounts: AccountPublic[];
  instagramAccounts: AccountPublic[];
}

export interface VideoSpec {
  type: 'video';
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  codec: string;
  bitrate: number;
  aspectRatio: string;
  hasAudio: boolean;
}

export interface ImageSpec {
  type: 'image';
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export type MediaSpec = VideoSpec | ImageSpec;

export interface PlatformValidation {
  platform: 'youtube' | 'facebook' | 'instagram';
  compatible: boolean;
  needsTranscode: boolean;
  reasons: string[];
}

export interface ProbedMedia {
  spec: MediaSpec;
  thumbnailPath: string | null;
  validations: PlatformValidation[];
}

export type Privacy = 'public' | 'private';

export interface CommonContent {
  title: string;
  description: string;
  hashtags: string;
  privacy: Privacy;
}

export interface PlatformOverride {
  enabled: boolean;
  /** 僅 YouTube 支援：勾選後跳過共通內容、用檔名當標題、其餘空白，讓使用者在 YT Studio 用頻道預設完成編輯 */
  useNativeDefaults?: boolean;
  /** 指定要發布到該平台的哪個帳號；未指定則用 listAccountsByPlatform()[0] */
  accountId?: number;
  title?: string;
  description?: string;
  hashtags?: string;
  privacy?: Privacy;
}

export interface PublishContent {
  common: CommonContent;
  perPlatform: {
    youtube: PlatformOverride;
    facebook: PlatformOverride;
    instagram: PlatformOverride;
    threads: PlatformOverride;
  };
  /**
   * v0.3.2：carousel 第 2..N 張的路徑（圖文模式專屬）
   * 若有此欄位且長度 >= 1，IG 發布時走 carousel API（主圖在 filePath，其他在這裡）
   */
  imageCarouselPaths?: string[];
}

/**
 * 品牌預設文案（勞資領航者｜企業軍師 林郁汶）
 *
 * 標題模板含 `{檔名}` placeholder，在以下時機自動替換成實際檔名（去副檔名）：
 *  - PublishPage：拖入/選擇影片完成 probe 後
 *  - SchedulePage 批量匯入：掃描資料夾後逐列替換
 */
export const BRAND_DEFAULTS: {
  titleTemplate: string;
  description: string;
  hashtags: string;
} = {
  titleTemplate:
    '【勞資領航者｜企業軍師 林郁汶】{檔名} #薪資結構 #資遣費計算 #勞資調解 #勞資糾紛',
  description: '',
  hashtags:
    '#勞資顧問 #勞動法規 #企業勞資管理 #勞資調解 #勞資糾紛 #薪資結構 #資遣費計算 #職災保險 #勞資講座 #企業顧問'
};

/**
 * 智慧檔名清理：去副檔名 + 遞迴 strip 常見前綴
 *
 * 會被 strip 的前綴模式：
 *  - 前導空白/分隔字元：`---`, `___`, ` `
 *  - 日期：`2024-01-15_` / `20240115_` / `2024.01.15-`
 *  - 純數字：`01-`, `001_`, `1.`, `1234 `
 *  - 短英數 ID（1-12 字元，至少一個英文字母）：`acv_`, `IMG_1234_`, `VID20240101_`
 *  - 括號內容：`[Episode 5]`, `(EP01)`, `{vol 3}`
 *
 * 中文字元不會被 strip（因為前綴 regex 限定 ASCII）。
 * 反覆套用直到不再變動，處理 `acv-001-真實標題.mp4` 這類複合前綴。
 * 若全 strip 變空字串，退回去副檔名後的原始檔名。
 */
export function cleanFilename(fileName: string): string {
  let result = fileName.replace(/\.[^.]+$/, '');
  const original = result;

  let changed = true;
  while (changed && result.length > 0) {
    const before = result;
    result = result.replace(/^[-._\s]+/, '');
    // 1. 日期前綴
    result = result.replace(/^\d{4}[-._\s]?\d{1,2}[-._\s]?\d{1,2}[-._\s]+/, '');
    // 2. 純數字前綴
    result = result.replace(/^\d{1,4}[-._\s]+/, '');
    // 3. 短英數 ID 前綴（至少含一個英文字母，1-12 chars）
    result = result.replace(/^(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{1,12}[-._\s]+/, '');
    // 4. 括號前綴
    result = result.replace(/^[\[\(\{][^\]\)\}]{1,15}[\]\)\}][-._\s]*/, '');
    changed = result !== before;
  }

  result = result.trim();
  // 全 strip 變空 → 退回原始（去副檔名後）
  return result.length === 0 ? original : result;
}

/** 把標題模板中的 {檔名} placeholder 替換為清理後的檔名 */
export function substituteTitleFilename(template: string, fileName: string): string {
  return template.replace(/\{檔名\}/g, cleanFilename(fileName));
}

export const DEFAULT_PUBLISH_CONTENT: PublishContent = {
  common: {
    title: BRAND_DEFAULTS.titleTemplate,
    description: BRAND_DEFAULTS.description,
    hashtags: BRAND_DEFAULTS.hashtags,
    privacy: 'public'
  },
  perPlatform: {
    youtube: { enabled: true },
    facebook: { enabled: true },
    instagram: { enabled: true },
    threads: { enabled: false } // v0.7.0：預設關閉，使用者連 Threads 帳號後再開
  }
};

export const PLATFORM_LIMITS = {
  youtube: { title: 100, description: 5000 },
  facebook: { title: 0, description: 63000 },
  instagram: { title: 0, description: 2200 },
  threads: { title: 0, description: 500 }
} as const;

export type NavTarget = 'publish' | 'schedule' | 'history' | 'accounts' | 'templates' | 'settings';

export type PublishPlatformStatus =
  | 'pending'
  | 'uploading'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface PublishPlatformState {
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  accountId: number;
  accountName: string;
  status: PublishPlatformStatus;
  percent: number;
  bytesUploaded?: number;
  totalBytes?: number;
  error?: string;
  url?: string;
}

export interface TranscodeProgress {
  inputPath: string;
  outputPath?: string;
  percent: number;
  currentSec: number;
  durationSec: number;
}

export interface PublishJobState {
  jobId: string;
  filePath: string;
  platforms: PublishPlatformState[];
  overallStatus: 'running' | 'done' | 'failed' | 'cancelled';
  startedAt: number;
  finishedAt?: number;
  /** 若需轉檔，在上傳前的預處理階段帶有此欄位；轉完設為 undefined */
  transcoding?: TranscodeProgress;
}

export interface PublishStartArgs {
  filePath: string;
  fileName?: string;
  thumbnailPath?: string | null;
  content: PublishContent;
  /** v0.3.0：'video' (default) 或 'image'；image 走 FB photos + IG image API */
  postType?: PostType;
}

export interface PublishProgressEvent {
  jobId: string;
  state: PublishJobState;
}

// ===== 歷史與草稿 =====

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'completed'
  | 'partial'
  | 'failed';
export type TargetStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface PostTargetRecord {
  id: number;
  platform: 'youtube' | 'facebook' | 'instagram' | 'threads';
  accountId: number | null;
  accountName: string;
  status: TargetStatus;
  remoteId: string | null;
  remoteUrl: string | null;
  errorMessage: string | null;
  finishedAt: number | null;
  /** v0.4.2：觸及數據 */
  views?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  sharesCount?: number | null;
  reach?: number | null;
  statsFetchedAt?: number | null;
  statsError?: string | null;
}

/**
 * v0.6.0：發布模式 tri-state
 * - 'video' (legacy alias for 'video-reels')：影片 → YT Shorts + FB Reels + IG Reels
 * - 'image' (legacy alias for 'image-post')：單張圖 → FB Photo + IG Single（無 YT）
 * - 'carousel'（v0.6.0 新）：多圖（2-10）→ FB MultiPhoto + IG Carousel（無 YT）
 *
 * Legacy values ('video' / 'image') 持續被 DB 與舊資料使用；新代碼建議用 PostMode 三態。
 */
export type PostType = 'video' | 'image' | 'carousel';
export type PostMode = 'video-reels' | 'image-post' | 'carousel';

/** v0.6.0：把 PostType ↔ PostMode 互轉的 helper（保持向後相容）*/
export function postTypeToMode(t: PostType | undefined): PostMode {
  if (t === 'carousel') return 'carousel';
  if (t === 'image') return 'image-post';
  return 'video-reels';
}
export function modeToPostType(m: PostMode): PostType {
  if (m === 'carousel') return 'carousel';
  if (m === 'image-post') return 'image';
  return 'video';
}

/** v0.6.0：從檔案副檔名 + 是否為多檔，自動推導 mode */
export function detectModeFromFiles(filePath: string, carouselPaths?: string[]): PostMode {
  const ext = filePath.toLowerCase().split('.').pop() ?? '';
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext);
  const isVideo = ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(ext);
  if (isImage) {
    const allFiles = [filePath, ...(carouselPaths ?? [])].filter(Boolean);
    return allFiles.length >= 2 ? 'carousel' : 'image-post';
  }
  if (isVideo) return 'video-reels';
  // 未知副檔名 → 預設視為影片（保留舊行為）
  return 'video-reels';
}

export interface PostRecord {
  id: number;
  title: string;
  description: string;
  hashtags: string;
  privacy: string | null;
  filePath: string | null;
  fileName: string | null;
  thumbnailPath: string | null;
  contentJson: string | null;
  status: PostStatus;
  jobId: string | null;
  scheduledAt: number | null;
  /** v0.3.0/v0.6.0：'video' / 'image' / 'carousel' */
  postType?: PostType;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  targets: PostTargetRecord[];
}

export interface ScheduleArgs {
  filePath: string;
  fileName: string;
  thumbnailPath: string | null;
  content: PublishContent;
  /** Unix ms timestamp（本機時區轉 UTC） */
  scheduledAt: number;
}

export interface BulkScheduleRow {
  rowIndex: number;
  videoPath: string;
  title: string;
  description: string;
  hashtags: string;
  scheduledAt: number;
  platforms: ('youtube' | 'facebook' | 'instagram')[];
  privacy: 'public' | 'private';
  /**
   * v0.2.9：每平台指定目標帳號 id（DB id）
   * 未指定 → 排程觸發時 fallback 到 accounts[0]（向後相容）
   */
  targetAccounts?: {
    youtube?: number;
    facebook?: number;
    instagram?: number;
  };
  errors: string[];
  warnings: string[];
}

export interface FolderVideoFile {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAt: number;
}

export interface FolderScanResult {
  folderPath: string;
  files: FolderVideoFile[];
}

// === v0.3.0：圖文批量模式 ===

/** A 模式：圖檔 + 同名 .txt 配對 */
export interface ImagePostPair {
  /** 圖檔絕對路徑（單張 = 該圖；carousel = 第 1 張）*/
  imagePath: string;
  /** 對應的 .txt 絕對路徑（A 模式有；B 模式為 null）*/
  textPath: string | null;
  /** 圖檔檔名（含副檔名）*/
  imageName: string;
  /** 配對檔基底名（不含副檔名）— 排序 + 顯示用 */
  baseName: string;
  /** 圖檔大小 bytes（主圖）*/
  imageSize: number;
  /** caption 內容 */
  caption: string;
  /** v0.3.1：主圖解析度（無法讀取則為 null）*/
  imageWidth?: number | null;
  imageHeight?: number | null;
  /**
   * v0.3.2：carousel 第 2..N 張的路徑（若為 undefined 或空陣列 = 單張貼文）
   * 加上 imagePath 主圖共 1+N 張，總數應 2-10 才會視為 carousel
   */
  additionalImagePaths?: string[];
  /** v0.3.1（B 模式專屬）：CSV 內指定的 hashtags */
  csvHashtags?: string;
  /** v0.3.1（B 模式專屬）：CSV 內指定的平台 */
  csvPlatforms?: ('facebook' | 'instagram')[];
  /** v0.3.1（B 模式專屬）：CSV 內指定的排程時間（unix ms）*/
  csvScheduledAt?: number;
  /** v0.3.1（B 模式專屬）：CSV 內指定的帳號別名（'fb:Pages名稱' 或 'ig:Username' 用空格分隔）*/
  csvAccountAlias?: string;
  /** v0.3.1：解析該 row 時的錯誤（如 CSV 必填欄位缺）*/
  csvErrors?: string[];
}

export interface ImageFolderScanResult {
  folderPath: string;
  /** 'pair-files' (A 模式) 或 'csv-manifest' (B 模式) */
  mode: 'pair-files' | 'csv-manifest';
  /** 配對成功的圖文 */
  pairs: ImagePostPair[];
  /** 警告訊息（如：找到圖檔但沒對應 .txt、找到 .txt 但沒對應圖檔）*/
  warnings: string[];
}

/** 圖文批量排程列（傳給 bulkCreateImagePosts IPC）*/
export interface ImagePostBulkRow {
  rowIndex: number;
  imagePath: string;
  imageName: string;
  caption: string;
  hashtags: string;
  scheduledAt: number;
  /** 圖文只支援 facebook / instagram，沒 youtube */
  platforms: ('facebook' | 'instagram')[];
  targetAccounts?: {
    facebook?: number;
    instagram?: number;
  };
  /** v0.3.2：carousel 第 2..N 張（單張為 undefined）*/
  additionalImagePaths?: string[];
  errors: string[];
  warnings: string[];
}

export interface SaveDraftArgs {
  filePath: string | null;
  fileName: string | null;
  thumbnailPath: string | null;
  content: PublishContent;
}

export interface GcDirStats {
  deleted: number;
  freedBytes: number;
  scanned: number;
}

export interface GcResult {
  /** 本次 GC 執行時間（ms epoch） */
  ranAt: number;
  transcoded: GcDirStats;
  thumbnails: GcDirStats;
}

// === v0.2.5 / 0.2.7：Meta long-lived user token 狀態（補上漏定義）===

export interface MetaUserTokenInfo {
  id: number;
  fbUserId: string;
  fbUserName: string | null;
  expiresAt: number;
  /** ms 到到期；負數表已過期 */
  remainingMs: number;
  lastRefreshAt: number | null;
  lastRefreshError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MetaTokenRefreshResult {
  fbUserId: string;
  fbUserName: string | null;
  status: 'refreshed' | 'still-fresh' | 'failed';
  oldExpiresAt: number;
  newExpiresAt?: number;
  pagesUpdated?: number;
  error?: string;
}

// === v0.4.1：資料夾監聽自動排程 ===

export interface WatcherTemplate {
  /** 標題模板（{檔名} 會自動替換）*/
  titleTemplate: string;
  description: string;
  hashtags: string;
  privacy: 'public' | 'private';
  platforms: ('youtube' | 'facebook' | 'instagram')[];
  targetAccounts?: {
    youtube?: number;
    facebook?: number;
    instagram?: number;
  };
}

export interface WatchedFolder {
  id: number;
  folderPath: string;
  /** 顯示用標籤（如「客戶 A 短影音」）*/
  label: string | null;
  enabled: boolean;
  template: WatcherTemplate;
  /** 下一篇要排到的時間（ms epoch）*/
  nextScheduleAt: number;
  /** 兩篇之間的間隔（小時）*/
  intervalHours: number;
  lastProcessedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWatchedFolderInput {
  folderPath: string;
  label?: string | null;
  template: WatcherTemplate;
  nextScheduleAt: number;
  intervalHours: number;
}

export interface UpdateWatchedFolderInput {
  id: number;
  label?: string | null;
  enabled?: boolean;
  template?: WatcherTemplate;
  nextScheduleAt?: number;
  intervalHours?: number;
}

// === v0.6.1：內文範本 ===

export type TemplateMode = 'any' | 'video-reels' | 'image-post' | 'carousel';

export interface ContentTemplate {
  id: number;
  name: string;
  mode: TemplateMode;
  titleTemplate: string | null;
  description: string | null;
  hashtags: string | null;
  privacy: string | null;
  perPlatformJson: string | null;
  targetAccountsJson: string | null;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTemplateInput {
  name: string;
  mode?: TemplateMode;
  titleTemplate?: string | null;
  description?: string | null;
  hashtags?: string | null;
  privacy?: string | null;
  perPlatformJson?: string | null;
  targetAccountsJson?: string | null;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: number;
}

// === v0.5.0：tunnel 設定 ===

export type TunnelMode = 'quick' | 'named-cloudflare';

export interface TunnelNamedConfigPublic {
  id: number;
  mode: 'named-cloudflare';
  publicHostname: string;
  hasToken: boolean;
  lastVerifiedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PuffinAPI {
  getVersion(): Promise<string>;
  ping(): Promise<string>;
  accounts: {
    list(): Promise<AccountPublic[]>;
    connectGoogle(): Promise<AccountPublic>;
    cancelGoogleAuth(): Promise<boolean>;
    connectMeta(): Promise<MetaConnectResult>;
    cancelMetaAuth(): Promise<boolean>;
    /** v0.7.0：Threads OAuth */
    connectThreads(): Promise<{
      user: { id: string; username?: string; name?: string };
      threadsAccounts: AccountPublic[];
    }>;
    cancelThreadsAuth(): Promise<boolean>;
    disconnect(id: number): Promise<boolean>;
    /** v0.4.4：測試帳號連線（call 對應平台 API，回傳是否成功 + 延遲 + 訊息）*/
    testConnection(accountId: number): Promise<{
      ok: boolean;
      displayName?: string;
      latencyMs: number;
      message: string;
    }>;
    /** v0.6.8：查 Meta token 實際 scope（debug_token endpoint） */
    debugMetaToken(accountId: number): Promise<{
      ok: boolean;
      data?: unknown;
      message: string;
    }>;
  };
  media: {
    probe(filePath: string): Promise<ProbedMedia>;
    getPathForFile(file: File): string;
    openFileDialog(): Promise<string | null>;
  };
  shortcuts: {
    /** 訂閱「導覽到 X 頁」事件，回傳取消訂閱函式 */
    onNavigate(callback: (target: NavTarget) => void): () => void;
    /** 訂閱「開啟檔案」快捷鍵事件，回傳取消訂閱函式 */
    onOpenFile(callback: () => void): () => void;
  };
  publish: {
    /** 啟動發布工作；回傳 jobId */
    start(args: PublishStartArgs): Promise<string>;
    /** 取消進行中的工作 */
    cancel(jobId: string): Promise<boolean>;
    /** 訂閱發布進度事件，回傳取消訂閱函式 */
    onProgress(callback: (event: PublishProgressEvent) => void): () => void;
    /** 重新發布既有 post（預設只重試 failed 的平台） */
    republish(postId: number, mode?: 'failedOnly' | 'all'): Promise<string>;
  };
  posts: {
    list(filter?: { status?: PostStatus | 'all' }): Promise<PostRecord[]>;
    get(id: number): Promise<PostRecord | null>;
    saveDraft(args: SaveDraftArgs): Promise<number>;
    delete(id: number): Promise<boolean>;
    /** 對既有 post 的單一失敗平台重新發布 */
    retryTarget(postId: number, platform: 'youtube' | 'facebook' | 'instagram' | 'threads'): Promise<string>;
    /** v0.4.2：抓取此 post 所有 target 的觸及數據（views/likes/comments/reach）*/
    fetchStats(postId: number): Promise<import('./types').PostTargetRecord[]>;
  };
  system: {
    /** 取得「電腦開機自動啟動」目前狀態 */
    getAutoLaunch(): Promise<boolean>;
    /** 設定「電腦開機自動啟動」狀態，回傳設定後的真實狀態 */
    setAutoLaunch(enabled: boolean): Promise<boolean>;
    /** 取得 userData 資料夾路徑 */
    getDataFolder(): Promise<string>;
    /** 在檔案總管開啟資料夾 */
    openDataFolder(): Promise<boolean>;
    /** 取得縮圖數量、空間、歷史筆數 */
    getStats(): Promise<{
      thumbnailCount: number;
      thumbnailBytes: number;
      transcodedCount: number;
      transcodedBytes: number;
      historyCount: number;
      dataFolder: string;
    }>;
    /** 清空所有歷史紀錄（保留 scheduled 排程），回傳被刪除筆數 */
    clearHistory(): Promise<number>;
    /** 清空縮圖快取，回傳刪除檔案數與釋放 bytes */
    clearThumbnails(): Promise<{ deleted: number; freedBytes: number }>;
    /** 清空自動轉檔的暫存影片 */
    clearTranscoded(): Promise<{ deleted: number; freedBytes: number }>;
    /** 取得 App 版本字串 */
    getVersion(): Promise<string>;
    /** 讀「上次自動 GC 結果」，若 App 還沒跑過一次回傳 null */
    getLastGc(): Promise<GcResult | null>;
    /** 立即執行一次 GC（同樣以「最後存取時間」為依據），回傳本次結果 */
    runGcNow(): Promise<GcResult>;
    /** v0.2.7：取得目前儲存的 Meta long-lived user token 清單 */
    listMetaUserTokens(): Promise<MetaUserTokenInfo[]>;
    /** v0.2.7：立即強制執行 Meta token refresh */
    refreshMetaTokens(): Promise<MetaTokenRefreshResult[]>;
    /** v0.3.3：取得「永久停用 AutoLaunch 自動保護」狀態 */
    getAutoLaunchPermanentlyDisabled(): Promise<boolean>;
    /** v0.3.3：設定永久停用狀態 */
    setAutoLaunchPermanentlyDisabled(value: boolean): Promise<boolean>;
    /** v0.4.0：匯出歷史紀錄為 CSV */
    exportHistoryCsv(): Promise<{ ok: boolean; path?: string; rows?: number; cancelled?: boolean }>;
    /** v0.4.0：檢查是否有新版可用 */
    checkForUpdate(): Promise<{
      latest: string;
      current: string;
      newer: boolean;
      downloadUrl?: string;
      releaseNotes?: string;
    }>;
    /** v0.4.6：強制重新下載 cloudflared（IG 上傳隧道工具）*/
    redownloadCloudflared(): Promise<{
      ok: boolean;
      path?: string;
      bytes?: number;
      error?: string;
    }>;
    /** v0.6.9：開 DevTools（debug 用） */
    openDevTools(): Promise<boolean>;
  };
  watchers: {
    /** v0.4.1：列出所有監聽資料夾 */
    list(): Promise<WatchedFolder[]>;
    /** v0.4.1：建立新監聽 */
    create(input: CreateWatchedFolderInput): Promise<number>;
    /** v0.4.1：更新監聽設定 */
    update(input: UpdateWatchedFolderInput): Promise<boolean>;
    /** v0.4.1：刪除監聽 */
    delete(id: number): Promise<boolean>;
    /** v0.4.1：開啟資料夾選擇 dialog */
    pickFolder(): Promise<string | null>;
  };
  /** v0.6.1：內文範本（套用 / 存常用內文）*/
  templates: {
    list(modeFilter?: TemplateMode): Promise<ContentTemplate[]>;
    get(id: number): Promise<ContentTemplate | null>;
    create(input: CreateTemplateInput): Promise<number>;
    update(input: UpdateTemplateInput): Promise<boolean>;
    delete(id: number): Promise<boolean>;
    duplicate(id: number, newName?: string): Promise<number>;
    recordUse(id: number): Promise<boolean>;
  };
  /** v0.5.0：tunnel 設定（IG/FB 公開 URL 隧道）*/
  tunnel: {
    getMode(): Promise<TunnelMode>;
    setMode(mode: TunnelMode): Promise<TunnelMode>;
    getNamedConfig(): Promise<TunnelNamedConfigPublic | null>;
    saveNamedConfig(input: { token: string; publicHostname: string }): Promise<TunnelNamedConfigPublic>;
    deleteNamedConfig(): Promise<boolean>;
    testNamed(input: { token: string; publicHostname: string }): Promise<{ ok: boolean; message: string }>;
    getNamedLocalPort(): Promise<number>;
  };
  schedule: {
    /** 排程單一發布；回傳 post id */
    create(args: ScheduleArgs): Promise<number>;
    /** 取消排程（從 scheduler 移除 + 刪除 post）*/
    cancel(postId: number): Promise<boolean>;
    /** 取消所有目前 scheduled post；回傳實際被取消的數量 */
    cancelAll(): Promise<number>;
    /** 列出未來的排程 */
    list(): Promise<PostRecord[]>;
    /** 掃描資料夾抓所有影片檔 */
    scanFolder(folderPath: string): Promise<FolderScanResult>;
    /** 開啟資料夾選擇 dialog */
    openFolderDialog(): Promise<string | null>;
    /** 把預覽通過的列批量建為排程；回傳建立的 post id 陣列 */
    bulkCreate(rows: BulkScheduleRow[]): Promise<number[]>;
    /** 將既有 post（任何狀態）改回 scheduled，到指定時間自動發布 */
    reschedule(postId: number, scheduledAt: number): Promise<boolean>;
    /** v0.3.0：掃描圖文資料夾（A 模式：jpg+txt 配對）*/
    scanImageFolder(folderPath: string): Promise<ImageFolderScanResult>;
    /** v0.3.0：批量建立圖文排程 */
    bulkCreateImagePosts(rows: ImagePostBulkRow[]): Promise<number[]>;
  };
}
