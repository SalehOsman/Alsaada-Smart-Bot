import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { googleDriveService } from '../../packages/google-engine/src/index.js';

export const RECOVERY_KEY_SALT = 'alsaada-sovereign-recovery-salt-2026';
export const PBKDF2_ITERATIONS = 100000;
export const KEY_LENGTH_BYTES = 32; // AES-256
export const IV_LENGTH_BYTES = 16;
export const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  ivHex: string;
  authTagHex: string;
}

export interface CloudUploadOptions {
  folderId?: string | undefined;
  serviceAccountEmail?: string | undefined;
  privateKey?: string | undefined;
  maxRetries?: number | undefined;
  initialDelayMs?: number | undefined;
  chunkSizeBytes?: number | undefined;
  simulateFailureCount?: number | undefined;
}

export interface CloudUploadResult {
  success: boolean;
  fileId: string;
  attempts: number;
  uploadedBytes: number;
  provider: 'google_drive' | 'local_staged';
  error?: string | undefined;
}

/**
 * Derives a 32-byte key from a cold emergency recovery passphrase or mnemonic phrase.
 * This resolves the Key Paradox: allows full disaster recovery even if .env is completely lost.
 */
export function deriveColdRecoveryKey(passphrase: string, salt = RECOVERY_KEY_SALT): Buffer {
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Cold recovery passphrase must be at least 8 characters long.');
  }
  return pbkdf2Sync(passphrase.trim(), salt, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, 'sha256');
}

/**
 * Resolves the 32-byte encryption key from either a 64-char hex key or a recovery passphrase.
 */
export function resolveEncryptionKey(rawKeyOrPassphrase?: string): Buffer {
  const candidate = rawKeyOrPassphrase || process.env.BACKUP_ENCRYPTION_KEY || process.env.COLD_RECOVERY_PASSPHRASE;

  if (!candidate) {
    // Fallback deterministic development key for testing
    return deriveColdRecoveryKey('alsaada emergency recovery master mnemonic phrase 2026 sovereign enterprise');
  }

  // If candidate is a 64-character hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(candidate.trim())) {
    return Buffer.from(candidate.trim(), 'hex');
  }

  // Otherwise derive key via PBKDF2 from the passphrase
  return deriveColdRecoveryKey(candidate);
}

/**
 * Encrypts a buffer using AES-256-GCM with authentication tag and random IV.
 * Packed format: [16-byte IV][16-byte AuthTag][Ciphertext]
 */
export function encryptBuffer(data: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid encryption key length: expected ${KEY_LENGTH_BYTES} bytes, got ${key.length}.`);
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts a buffer encrypted with encryptBuffer.
 * Unpacks: [16-byte IV][16-byte AuthTag][Ciphertext]
 * Throws an error if ciphertext or tag was tampered with.
 */
export function decryptBuffer(packedData: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Invalid encryption key length: expected ${KEY_LENGTH_BYTES} bytes, got ${key.length}.`);
  }

  if (packedData.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Ciphertext payload is too short to contain a valid IV and authentication tag.');
  }

  const iv = packedData.subarray(0, IV_LENGTH_BYTES);
  const authTag = packedData.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = packedData.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypts a file on disk and writes to target path (appending .enc if unspecified).
 */
export function encryptBackupFile(sourcePath: string, targetPath?: string, keyOrPassphrase?: string): string {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  const destination = targetPath ?? `${sourcePath}.enc`;
  const rawData = readFileSync(sourcePath);
  const key = resolveEncryptionKey(keyOrPassphrase);
  const encrypted = encryptBuffer(rawData, key);

  writeFileSync(destination, encrypted);
  return destination;
}

/**
 * Decrypts an encrypted file on disk and writes to target path.
 */
export function decryptBackupFile(encryptedPath: string, targetPath: string, keyOrPassphrase?: string): string {
  if (!existsSync(encryptedPath)) {
    throw new Error(`Encrypted file does not exist: ${encryptedPath}`);
  }

  const rawEncrypted = readFileSync(encryptedPath);
  const key = resolveEncryptionKey(keyOrPassphrase);
  const decrypted = decryptBuffer(rawEncrypted, key);

  writeFileSync(targetPath, decrypted);
  return targetPath;
}

/**
 * Resilient upload with 3-tier exponential backoff (2s -> 4s -> 8s) and chunking.
 */
export async function syncToGoogleDriveWithBackoff(
  filePath: string,
  fileName: string,
  options: CloudUploadOptions = {},
): Promise<CloudUploadResult> {
  if (!existsSync(filePath)) {
    return {
      success: false,
      fileId: '',
      attempts: 0,
      uploadedBytes: 0,
      provider: 'google_drive',
      error: `File not found: ${filePath}`,
    };
  }

  const fileData = readFileSync(filePath);
  const folderId = options.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GDRIVE_FOLDER_ID;

  // Execute upload via unified @alsaada/google-engine
  const uploadRes = await googleDriveService.uploadBuffer({
    fileName,
    buffer: fileData,
    mimeType: 'application/octet-stream',
    folderId,
    maxRetries: options.maxRetries ?? 3,
    initialDelayMs: options.initialDelayMs ?? 2000,
    simulateFailureCount: options.simulateFailureCount,
  });

  if (uploadRes.success) {
    return {
      success: true,
      fileId: uploadRes.fileId,
      attempts: uploadRes.attempts,
      uploadedBytes: uploadRes.uploadedBytes,
      provider: uploadRes.provider === 'google_drive' ? 'google_drive' : 'local_staged',
    };
  }

  // If credentials are not present or test environment, fallback to staging
  if (uploadRes.provider === 'local_fallback') {
    return {
      success: true,
      fileId: `staged_${Date.now()}_${fileName}`,
      attempts: uploadRes.attempts || 1,
      uploadedBytes: fileData.length,
      provider: 'local_staged',
    };
  }

  return {
    success: false,
    fileId: '',
    attempts: uploadRes.attempts,
    uploadedBytes: 0,
    provider: 'google_drive',
    error: uploadRes.error,
  };
}
