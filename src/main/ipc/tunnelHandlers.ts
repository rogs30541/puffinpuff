/**
 * v0.5.0：tunnel 設定 IPC
 */
import { ipcMain } from 'electron';
import {
  getTunnelMode,
  setTunnelMode,
  type TunnelMode
} from '../lib/settingsRepo';
import {
  getTunnelConfigInternal,
  getTunnelConfigPublic,
  upsertTunnelConfig,
  deleteTunnelConfig,
  markTunnelConfigVerified,
  type TunnelConfigPublic
} from '../lib/tunnelConfigRepo';
import { testNamedTunnelConnection, NAMED_TUNNEL_LOCAL_PORT, shutdownNamedTunnelSingleton } from '../lib/tunnel';
import {
  getS3ConfigInternal,
  getS3ConfigPublic,
  upsertS3Config,
  deleteS3Config,
  markS3ConfigVerified,
  type S3ConfigPublic
} from '../lib/s3ConfigRepo';
import { testS3Connection } from '../lib/s3MediaHost';

export function registerTunnelHandlers(): void {
  ipcMain.handle('tunnel:getMode', (): TunnelMode => getTunnelMode());

  ipcMain.handle('tunnel:setMode', (_e, mode: TunnelMode): TunnelMode => {
    setTunnelMode(mode);
    // v0.8.0：切離 named tunnel 模式時關掉常駐 singleton（省資源）
    if (mode !== 'named-cloudflare') {
      void shutdownNamedTunnelSingleton().catch(() => {});
    }
    return getTunnelMode();
  });

  ipcMain.handle(
    'tunnel:getNamedConfig',
    (): TunnelConfigPublic | null => getTunnelConfigPublic('named-cloudflare')
  );

  ipcMain.handle(
    'tunnel:saveNamedConfig',
    (_e, input: { token: string; publicHostname: string }): TunnelConfigPublic => {
      if (!input?.token || input.token.trim().length < 10) {
        throw new Error('Token 為空或長度不足，請貼入完整 Cloudflare tunnel token');
      }
      const hostname = (input.publicHostname ?? '').trim();
      if (!hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) {
        throw new Error(`Hostname 格式不正確：${hostname}`);
      }
      return upsertTunnelConfig({
        mode: 'named-cloudflare',
        token: input.token.trim(),
        publicHostname: hostname
      });
    }
  );

  ipcMain.handle(
    'tunnel:deleteNamedConfig',
    (): boolean => deleteTunnelConfig('named-cloudflare')
  );

  ipcMain.handle(
    'tunnel:testNamed',
    async (_e, input: { token: string; publicHostname: string }): Promise<{ ok: boolean; message: string }> => {
      // v0.5.2：token 空時 fallback 用 DB 儲存的（解密後的）token，讓使用者不用重貼
      let effectiveToken = (input?.token ?? '').trim();
      const hostname = (input?.publicHostname ?? '').trim();
      if (!effectiveToken) {
        const internal = getTunnelConfigInternal('named-cloudflare');
        if (!internal) {
          return {
            ok: false,
            message: 'Token 為空且沒有已儲存的設定 — 請先貼 token 並儲存設定，或直接貼 token 後測試'
          };
        }
        effectiveToken = internal.token;
        console.log('[tunnel:testNamed] using stored DB token for test');
      }
      const result = await testNamedTunnelConnection({
        token: effectiveToken,
        publicHostname: hostname
      });
      // 若測試的是現有儲存的設定 → 順便更新 last_verified_at / last_error
      const existing = getTunnelConfigPublic('named-cloudflare');
      if (existing && existing.publicHostname === hostname) {
        markTunnelConfigVerified('named-cloudflare', result.ok, result.ok ? undefined : result.message);
      }
      return result;
    }
  );

  ipcMain.handle(
    'tunnel:getNamedLocalPort',
    (): number => NAMED_TUNNEL_LOCAL_PORT
  );

  // ===== v0.8.0：S3 相容物件儲存 =====

  ipcMain.handle('tunnel:getS3Config', (): S3ConfigPublic | null => getS3ConfigPublic());

  ipcMain.handle(
    'tunnel:saveS3Config',
    (_e, input: {
      endpoint: string;
      bucket: string;
      region?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string | null;
    }): S3ConfigPublic => {
      const endpoint = (input?.endpoint ?? '').trim();
      if (!/^https?:\/\/.+/.test(endpoint)) {
        throw new Error(`Endpoint 必須是完整網址（https:// 開頭）：${endpoint || '(空)'}`);
      }
      const bucket = (input?.bucket ?? '').trim();
      if (!bucket) throw new Error('Bucket 名稱不可為空');
      if (!input?.accessKeyId?.trim() || !input?.secretAccessKey?.trim()) {
        throw new Error('Access Key ID 與 Secret Access Key 皆不可為空');
      }
      const publicBaseUrl = (input.publicBaseUrl ?? '').trim();
      if (publicBaseUrl && !/^https?:\/\/.+/.test(publicBaseUrl)) {
        throw new Error(`公開 URL 前綴必須是完整網址（https:// 開頭）：${publicBaseUrl}`);
      }
      return upsertS3Config({
        endpoint,
        bucket,
        region: input.region,
        accessKeyId: input.accessKeyId.trim(),
        secretAccessKey: input.secretAccessKey.trim(),
        publicBaseUrl: publicBaseUrl || null
      });
    }
  );

  ipcMain.handle('tunnel:deleteS3Config', (): boolean => deleteS3Config());

  ipcMain.handle(
    'tunnel:testS3',
    async (_e, input: {
      endpoint: string;
      bucket: string;
      region?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string | null;
    }): Promise<{ ok: boolean; message: string }> => {
      // keys 空時 fallback 用 DB 儲存的（跟 named tunnel 測試同 UX：不用重貼）
      let effective = { ...input };
      if (!effective?.accessKeyId?.trim() || !effective?.secretAccessKey?.trim()) {
        const stored = getS3ConfigInternal();
        if (!stored) {
          return {
            ok: false,
            message: 'Keys 為空且沒有已儲存的設定 — 請先填 Access Key / Secret Key 並儲存，或直接填入後測試'
          };
        }
        effective = {
          endpoint: effective.endpoint?.trim() || stored.endpoint,
          bucket: effective.bucket?.trim() || stored.bucket,
          region: effective.region?.trim() || stored.region,
          accessKeyId: stored.accessKeyId,
          secretAccessKey: stored.secretAccessKey,
          publicBaseUrl: effective.publicBaseUrl !== undefined ? effective.publicBaseUrl : stored.publicBaseUrl
        };
        console.log('[tunnel:testS3] using stored DB keys for test');
      }
      const result = await testS3Connection(effective);
      // 測的是已儲存設定 → 順便記 verified 狀態
      const stored = getS3ConfigPublic();
      if (stored && stored.endpoint === effective.endpoint.trim() && stored.bucket === effective.bucket.trim()) {
        markS3ConfigVerified(result.ok, result.ok ? undefined : result.message);
      }
      return result;
    }
  );
}
