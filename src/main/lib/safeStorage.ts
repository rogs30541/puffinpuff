import { safeStorage } from 'electron';

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptString(value: string): Uint8Array {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Encryption is unavailable. On Windows this means the OS DPAPI service is broken or running under an unusual profile.'
    );
  }
  return safeStorage.encryptString(value);
}

export function decryptString(buffer: Uint8Array | Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is unavailable; cannot decrypt stored token.');
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return safeStorage.decryptString(buf);
}
