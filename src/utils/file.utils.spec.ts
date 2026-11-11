import {
  sanitizeFileName,
  buildS3Key,
  calculateTtlEpochSeconds,
  isExpired,
  formatBytes,
} from './file.utils';
import { FILE_CONSTANTS } from '../constants';

describe('FileUtils', () => {
  describe('sanitizeFileName', () => {
    it('should keep standard alphanumeric filenames with safe extensions', () => {
      expect(sanitizeFileName('report-2026.final.pdf')).toBe('report-2026.final.pdf');
    });

    it('should replace spaces and special characters with underscores', () => {
      expect(sanitizeFileName('my test file (1) & $$.png')).toBe('my_test_file__1_______png');
    });

    it('should sanitize path traversal attempts', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    });

    it('should return fallback if input is empty or null', () => {
      expect(sanitizeFileName('')).toBe('unnamed_file');
    });
  });

  describe('buildS3Key', () => {
    it('should construct correct S3 key with uploads prefix and fileId', () => {
      const fileId = '123e4567-e89b-12d3-a456-426614174000';
      const key = buildS3Key(fileId, 'photo.jpg');
      expect(key).toBe(`uploads/${fileId}/photo.jpg`);
    });
  });

  describe('calculateTtlEpochSeconds', () => {
    it('should calculate timestamp in the future corresponding to expiry hours', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ttl = calculateTtlEpochSeconds(24);
      expect(ttl).toBeGreaterThanOrEqual(nowSeconds + 24 * 3600 - 2);
      expect(ttl).toBeLessThanOrEqual(nowSeconds + 24 * 3600 + 2);
    });

    it('should clamp expiry hours within min and max boundaries', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      // Min limit (1 hour)
      const minTtl = calculateTtlEpochSeconds(0);
      expect(minTtl).toBeGreaterThanOrEqual(nowSeconds + FILE_CONSTANTS.MIN_EXPIRY_HOURS * 3600 - 2);

      // Max limit (168 hours = 7 days)
      const maxTtl = calculateTtlEpochSeconds(500);
      expect(maxTtl).toBeLessThanOrEqual(nowSeconds + FILE_CONSTANTS.MAX_EXPIRY_HOURS * 3600 + 2);
    });
  });

  describe('isExpired', () => {
    it('should return true for timestamps in the past', () => {
      const pastEpoch = Math.floor(Date.now() / 1000) - 100;
      expect(isExpired(pastEpoch)).toBe(true);
    });

    it('should return false for timestamps in the future', () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
      expect(isExpired(futureEpoch)).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes to KB, MB, and GB accurately', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });
});

