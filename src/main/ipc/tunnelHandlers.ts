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
import { testNamedTunnelConnection, NAMED_TUNNEL_LOCAL_PORT } from '../lib/tunnel';

export function registerTunnelHandlers(): void {
  ipcMain.handle('tunnel:getMode', (): TunnelMode => getTunnelMode());

  ipcMain.handle('tunnel:setMode', (_e, mode: TunnelMode): TunnelMode => {
    setTunnelMode(mode);
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
}
