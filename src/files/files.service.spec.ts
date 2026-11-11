import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { AwsService, FileRecord } from '../aws/aws.service';
import { FileStatus } from '../constants';

describe('FilesService', () => {
  let service: FilesService;
  let awsService: jest.Mocked<Partial<AwsService>>;

  beforeEach(async () => {
    awsService = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/test-upload-url'),
      generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/test-download-url'),
      saveFileRecord: jest.fn().mockResolvedValue(undefined),
      getFileRecord: jest.fn(),
      listFileRecords: jest.fn(),
      incrementDownloadCount: jest.fn().mockResolvedValue(1),
      updateFileStatus: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: AwsService,
          useValue: awsService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('requestUpload', () => {
    it('should create an upload session with PENDING status and return a pre-signed URL', async () => {
      const dto = {
        fileName: 'test-doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1048576,
        expiryHours: 12,
        tags: ['test'],
      };

      const result = await service.requestUpload(dto);

      expect(result.fileId).toBeDefined();
      expect(result.uploadUrl).toBe('https://s3.amazonaws.com/test-upload-url');
      expect(result.s3Key).toContain('uploads/');
      expect(result.s3Key).toContain('test-doc.pdf');
      expect(awsService.saveFileRecord).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmUpload', () => {
    it('should mark status as READY when file exists', async () => {
      const mockRecord: FileRecord = {
        fileId: 'mock-123',
        originalName: 'test.pdf',
        s3Key: 'uploads/mock-123/test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        status: FileStatus.PENDING,
        uploadedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        downloadCount: 0,
      };

      awsService.getFileRecord = jest.fn().mockResolvedValue(mockRecord);

      const result = await service.confirmUpload('mock-123');
      expect(result.status).toBe(FileStatus.READY);
      expect(awsService.updateFileStatus).toHaveBeenCalledWith('mock-123', FileStatus.READY);
    });

    it('should throw NotFoundException if file record does not exist', async () => {
      awsService.getFileRecord = jest.fn().mockResolvedValue(null);
      await expect(service.confirmUpload('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileDetails', () => {
    it('should throw BadRequestException if file has expired', async () => {
      const expiredRecord: FileRecord = {
        fileId: 'expired-123',
        originalName: 'expired.pdf',
        s3Key: 'uploads/expired-123/expired.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        status: FileStatus.READY,
        uploadedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        downloadCount: 0,
      };

      awsService.getFileRecord = jest.fn().mockResolvedValue(expiredRecord);
      await expect(service.getFileDetails('expired-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should increment download count and return pre-signed download URL', async () => {
      const validRecord: FileRecord = {
        fileId: 'valid-123',
        originalName: 'valid.pdf',
        s3Key: 'uploads/valid-123/valid.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        status: FileStatus.READY,
        uploadedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        downloadCount: 0,
      };

      awsService.getFileRecord = jest.fn().mockResolvedValue(validRecord);
      awsService.incrementDownloadCount = jest.fn().mockResolvedValue(1);

      const result = await service.getDownloadUrl('valid-123');
      expect(result.downloadUrl).toBe('https://s3.amazonaws.com/test-download-url');
      expect(result.downloadCount).toBe(1);
      expect(awsService.incrementDownloadCount).toHaveBeenCalledWith('valid-123');
    });
  });
});
