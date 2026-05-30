import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AccountPublic,
  BulkScheduleRow,
  ContentTemplate,
  CreateTemplateInput,
  CreateWatchedFolderInput,
  FolderScanResult,
  GcResult,
  ImageFolderScanResult,
  ImagePostBulkRow,
  MetaConnectResult,
  MetaTokenRefreshResult,
  MetaUserTokenInfo,
  NavTarget,
  PostRecord,
  PostStatus,
  ProbedMedia,
  PublishProgressEvent,
  PublishStartArgs,
  PuffinAPI,
  SaveDraftArgs,
  ScheduleArgs,
  TemplateMode,
  TunnelMode,
  TunnelNamedConfigPublic,
  UpdateTemplateInput,
  UpdateWatchedFolderInput,
  WatchedFolder
} from '../shared/types';

const api: PuffinAPI = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  ping: () => ipcRenderer.invoke('app:ping'),

  accounts: {
    list: () => ipcRenderer.invoke('accounts:list') as Promise<AccountPublic[]>,
    connectGoogle: () => ipcRenderer.invoke('accounts:connectGoogle') as Promise<AccountPublic>,
    cancelGoogleAuth: () => ipcRenderer.invoke('accounts:cancelGoogleAuth') as Promise<boolean>,
    connectMeta: () => ipcRenderer.invoke('accounts:connectMeta') as Promise<MetaConnectResult>,
    cancelMetaAuth: () => ipcRenderer.invoke('accounts:cancelMetaAuth') as Promise<boolean>,
    disconnect: (id) => ipcRenderer.invoke('accounts:disconnect', id) as Promise<boolean>,
    testConnection: (accountId: number) =>
      ipcRenderer.invoke('accounts:testConnection', accountId) as Promise<{
        ok: boolean;
        displayName?: string;
        latencyMs: number;
        message: string;
      }>,
    debugMetaToken: (accountId: number) =>
      ipcRenderer.invoke('accounts:debugMetaToken', accountId) as Promise<{
        ok: boolean;
        data?: unknown;
        message: string;
      }>
  },

  media: {
    probe: (filePath: string) =>
      ipcRenderer.invoke('media:probe', filePath) as Promise<ProbedMedia>,
    getPathForFile: (file: File): string => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return '';
      }
    },
    openFileDialog: () => ipcRenderer.invoke('media:openFileDialog') as Promise<string | null>
  },

  shortcuts: {
    onNavigate: (callback: (target: NavTarget) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, target: NavTarget) => callback(target);
      ipcRenderer.on('nav:goto', listener);
      return () => {
        ipcRenderer.removeListener('nav:goto', listener);
      };
    },
    onOpenFile: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('shortcut:openFile', listener);
      return () => {
        ipcRenderer.removeListener('shortcut:openFile', listener);
      };
    }
  },

  publish: {
    start: (args: PublishStartArgs) =>
      ipcRenderer.invoke('publish:start', args) as Promise<string>,
    cancel: (jobId: string) =>
      ipcRenderer.invoke('publish:cancel', jobId) as Promise<boolean>,
    onProgress: (callback: (event: PublishProgressEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, evt: PublishProgressEvent) =>
        callback(evt);
      ipcRenderer.on('publish:progress', listener);
      return () => {
        ipcRenderer.removeListener('publish:progress', listener);
      };
    },
    republish: (postId: number, mode: 'failedOnly' | 'all' = 'failedOnly') =>
      ipcRenderer.invoke('publish:republish', postId, mode) as Promise<string>
  },

  posts: {
    list: (filter?: { status?: PostStatus | 'all' }) =>
      ipcRenderer.invoke('posts:list', filter) as Promise<PostRecord[]>,
    get: (id: number) =>
      ipcRenderer.invoke('posts:get', id) as Promise<PostRecord | null>,
    saveDraft: (args: SaveDraftArgs) =>
      ipcRenderer.invoke('posts:saveDraft', args) as Promise<number>,
    delete: (id: number) =>
      ipcRenderer.invoke('posts:delete', id) as Promise<boolean>,
    retryTarget: (postId: number, platform: 'youtube' | 'facebook' | 'instagram') =>
      ipcRenderer.invoke('posts:retryTarget', postId, platform) as Promise<string>,
    fetchStats: (postId: number) =>
      ipcRenderer.invoke('posts:fetchStats', postId) as Promise<unknown>
  },

  system: {
    getAutoLaunch: () =>
      ipcRenderer.invoke('system:getAutoLaunch') as Promise<boolean>,
    setAutoLaunch: (enabled: boolean) =>
      ipcRenderer.invoke('system:setAutoLaunch', enabled) as Promise<boolean>,
    getDataFolder: () => ipcRenderer.invoke('system:getDataFolder') as Promise<string>,
    openDataFolder: () => ipcRenderer.invoke('system:openDataFolder') as Promise<boolean>,
    getStats: () =>
      ipcRenderer.invoke('system:getStats') as Promise<{
        thumbnailCount: number;
        thumbnailBytes: number;
        transcodedCount: number;
        transcodedBytes: number;
        historyCount: number;
        dataFolder: string;
      }>,
    clearHistory: () => ipcRenderer.invoke('system:clearHistory') as Promise<number>,
    clearThumbnails: () =>
      ipcRenderer.invoke('system:clearThumbnails') as Promise<{ deleted: number; freedBytes: number }>,
    clearTranscoded: () =>
      ipcRenderer.invoke('system:clearTranscoded') as Promise<{ deleted: number; freedBytes: number }>,
    getVersion: () => ipcRenderer.invoke('system:getVersion') as Promise<string>,
    getLastGc: () => ipcRenderer.invoke('system:getLastGc') as Promise<GcResult | null>,
    runGcNow: () => ipcRenderer.invoke('system:runGcNow') as Promise<GcResult>,
    listMetaUserTokens: () =>
      ipcRenderer.invoke('system:listMetaUserTokens') as Promise<MetaUserTokenInfo[]>,
    refreshMetaTokens: () =>
      ipcRenderer.invoke('system:refreshMetaTokens') as Promise<MetaTokenRefreshResult[]>,
    getAutoLaunchPermanentlyDisabled: () =>
      ipcRenderer.invoke('system:getAutoLaunchPermanentlyDisabled') as Promise<boolean>,
    setAutoLaunchPermanentlyDisabled: (value: boolean) =>
      ipcRenderer.invoke('system:setAutoLaunchPermanentlyDisabled', value) as Promise<boolean>,
    exportHistoryCsv: () =>
      ipcRenderer.invoke('system:exportHistoryCsv') as Promise<{ ok: boolean; path?: string; rows?: number; cancelled?: boolean }>,
    checkForUpdate: () =>
      ipcRenderer.invoke('system:checkForUpdate') as Promise<{
        latest: string;
        current: string;
        newer: boolean;
        downloadUrl?: string;
        releaseNotes?: string;
      }>,
    redownloadCloudflared: () =>
      ipcRenderer.invoke('system:redownloadCloudflared') as Promise<{
        ok: boolean;
        path?: string;
        bytes?: number;
        error?: string;
      }>,
    openDevTools: () => ipcRenderer.invoke('system:openDevTools') as Promise<boolean>
  },

  schedule: {
    create: (args: ScheduleArgs) =>
      ipcRenderer.invoke('schedule:create', args) as Promise<number>,
    cancel: (postId: number) =>
      ipcRenderer.invoke('schedule:cancel', postId) as Promise<boolean>,
    cancelAll: () =>
      ipcRenderer.invoke('schedule:cancelAll') as Promise<number>,
    list: () => ipcRenderer.invoke('schedule:list') as Promise<PostRecord[]>,
    scanFolder: (folderPath: string) =>
      ipcRenderer.invoke('schedule:scanFolder', folderPath) as Promise<FolderScanResult>,
    openFolderDialog: () =>
      ipcRenderer.invoke('schedule:openFolderDialog') as Promise<string | null>,
    bulkCreate: (rows: BulkScheduleRow[]) =>
      ipcRenderer.invoke('schedule:bulkCreate', rows) as Promise<number[]>,
    reschedule: (postId: number, scheduledAt: number) =>
      ipcRenderer.invoke('schedule:reschedule', postId, scheduledAt) as Promise<boolean>,
    scanImageFolder: (folderPath: string) =>
      ipcRenderer.invoke('schedule:scanImageFolder', folderPath) as Promise<ImageFolderScanResult>,
    bulkCreateImagePosts: (rows: ImagePostBulkRow[]) =>
      ipcRenderer.invoke('schedule:bulkCreateImagePosts', rows) as Promise<number[]>
  },

  watchers: {
    list: () => ipcRenderer.invoke('watchers:list') as Promise<WatchedFolder[]>,
    create: (input: CreateWatchedFolderInput) =>
      ipcRenderer.invoke('watchers:create', input) as Promise<number>,
    update: (input: UpdateWatchedFolderInput) =>
      ipcRenderer.invoke('watchers:update', input) as Promise<boolean>,
    delete: (id: number) => ipcRenderer.invoke('watchers:delete', id) as Promise<boolean>,
    pickFolder: () => ipcRenderer.invoke('watchers:pickFolder') as Promise<string | null>
  },

  templates: {
    list: (modeFilter?: TemplateMode) =>
      ipcRenderer.invoke('templates:list', modeFilter) as Promise<ContentTemplate[]>,
    get: (id: number) =>
      ipcRenderer.invoke('templates:get', id) as Promise<ContentTemplate | null>,
    create: (input: CreateTemplateInput) =>
      ipcRenderer.invoke('templates:create', input) as Promise<number>,
    update: (input: UpdateTemplateInput) =>
      ipcRenderer.invoke('templates:update', input) as Promise<boolean>,
    delete: (id: number) => ipcRenderer.invoke('templates:delete', id) as Promise<boolean>,
    duplicate: (id: number, newName?: string) =>
      ipcRenderer.invoke('templates:duplicate', id, newName) as Promise<number>,
    recordUse: (id: number) =>
      ipcRenderer.invoke('templates:recordUse', id) as Promise<boolean>
  },

  tunnel: {
    getMode: () => ipcRenderer.invoke('tunnel:getMode') as Promise<TunnelMode>,
    setMode: (mode: TunnelMode) =>
      ipcRenderer.invoke('tunnel:setMode', mode) as Promise<TunnelMode>,
    getNamedConfig: () =>
      ipcRenderer.invoke('tunnel:getNamedConfig') as Promise<TunnelNamedConfigPublic | null>,
    saveNamedConfig: (input: { token: string; publicHostname: string }) =>
      ipcRenderer.invoke('tunnel:saveNamedConfig', input) as Promise<TunnelNamedConfigPublic>,
    deleteNamedConfig: () =>
      ipcRenderer.invoke('tunnel:deleteNamedConfig') as Promise<boolean>,
    testNamed: (input: { token: string; publicHostname: string }) =>
      ipcRenderer.invoke('tunnel:testNamed', input) as Promise<{ ok: boolean; message: string }>,
    getNamedLocalPort: () =>
      ipcRenderer.invoke('tunnel:getNamedLocalPort') as Promise<number>
  }
};

try {
  contextBridge.exposeInMainWorld('puffin', api);
} catch (error) {
  console.error('contextBridge expose failed:', error);
}
