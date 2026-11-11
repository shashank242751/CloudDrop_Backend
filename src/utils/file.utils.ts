import { FILE_CONSTANTS } from '../constants';

/**
 * Sanitizes a file name by removing dangerous characters and spaces
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return 'unnamed_file';
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Builds the canonical S3 object key for a file transfer
 * Convention: uploads/{fileId}/{sanitizedFileName}
 */
export function buildS3Key(fileId: string, fileName: string): string {
  const cleanName = sanitizeFileName(fileName);
  return `${FILE_CONSTANTS.S3_UPLOAD_PREFIX}/${fileId}/${cleanName}`;
}

/**
 * Calculates the DynamoDB TTL expiration timestamp in Unix epoch seconds
 */
export function calculateTtlEpochSeconds(expiryHours: number = FILE_CONSTANTS.DEFAULT_EXPIRY_HOURS): number {
  const clampedHours = Math.max(
    FILE_CONSTANTS.MIN_EXPIRY_HOURS,
    Math.min(expiryHours, FILE_CONSTANTS.MAX_EXPIRY_HOURS),
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds + clampedHours * 3600;
}

/**
 * Checks if a given epoch timestamp has passed
 */
export function isExpired(epochSeconds: number): boolean {
  if (!epochSeconds) return false;
  return Math.floor(Date.now() / 1000) > epochSeconds;
}

/**
 * Converts bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

