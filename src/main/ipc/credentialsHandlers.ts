/**
 * v0.9.0：OAuth 憑證自帶 IPC
 */
import { ipcMain } from 'electron';
import {
  getAllCredentialStatuses,
  saveCredentials,
  deleteCredentials,
  type CredentialProvider,
  type CredentialStatus
} from '../lib/credentialsStore';

const VALID_PROVIDERS: CredentialProvider[] = ['google', 'meta', 'threads'];

function assertProvider(p: string): CredentialProvider {
  if (!VALID_PROVIDERS.includes(p as CredentialProvider)) {
    throw new Error(`未知的 provider：${p}`);
  }
  return p as CredentialProvider;
}

export function registerCredentialsHandlers(): void {
  ipcMain.handle('credentials:getStatus', (): CredentialStatus[] => getAllCredentialStatuses());

  ipcMain.handle(
    'credentials:save',
    (_e, provider: string, jsonText: string): CredentialStatus =>
      saveCredentials(assertProvider(provider), jsonText)
  );

  ipcMain.handle(
    'credentials:delete',
    (_e, provider: string): CredentialStatus => deleteCredentials(assertProvider(provider))
  );
}
