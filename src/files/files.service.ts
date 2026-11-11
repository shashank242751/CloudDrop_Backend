import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AwsService, FileRecord } from '../aws/aws.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { FileStatus, FILE_CONSTANTS } from '../constants';
import { buildS3Key, calculateTtlEpochSeconds, isExpired } from '../utils';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly awsService: AwsService) {}

  async requestUpload(dto: CreateUploadDto) {
    const fileId = uuidv4();
    const s3Key = buildS3Key(fileId, dto.fileName);
    const ttlSeconds = calculateTtlEpochSeconds(dto.expiryHours || FILE_CONSTANTS.DEFAULT_EXPIRY_HOURS);

    // 1. Generate pre-signed PUT URL (valid for 15 minutes)
    const uploadUrl = await this.awsService.generatePresignedUploadUrl(
      s3Key,
      dto.mimeType,
      FILE_CONSTANTS.PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    );

    // 2. Register metadata record in DynamoDB with PENDING status
    const record: FileRecord = {
      fileId,
      originalName: dto.fileName,
      s3Key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      status: FileStatus.PENDING,
      uploadedAt: new Date().toISOString(),
      expiresAt: ttlSeconds,
      downloadCount: 0,
      tags: dto.tags || [],
    };

    await this.awsService.saveFileRecord(record);
    this.logger.log(`Created upload session for file: ${dto.fileName} (${fileId})`);

    return {
      fileId,
      s3Key,
      uploadUrl,
      expiresAt: new Date(ttlSeconds * 1000).toISOString(),
    };
  }

  async confirmUpload(fileId: string) {
    const record = await this.awsService.getFileRecord(fileId);
    if (!record) {
      throw new NotFoundException(`File record ${fileId} not found`);
    }

    // Mark status as READY once client confirms upload
    await this.awsService.updateFileStatus(fileId, FileStatus.READY);
    return {
      message: 'File upload confirmed successfully',
      fileId,
      status: FileStatus.READY,
    };
  }

  async listFiles() {
    return this.awsService.listFileRecords();
  }

  async getFileDetails(fileId: string) {
    const record = await this.awsService.getFileRecord(fileId);
    if (!record) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    if (isExpired(record.expiresAt)) {
      throw new BadRequestException('This file transfer has expired');
    }

    return record;
  }

  async getDownloadUrl(fileId: string) {
    const record = await this.getFileDetails(fileId);

    // Increment download counter in DynamoDB
    const newCount = await this.awsService.incrementDownloadCount(fileId);

    // Generate pre-signed GET URL (valid for 5 minutes)
    const downloadUrl = await this.awsService.generatePresignedDownloadUrl(
      record.s3Key,
      record.originalName,
      FILE_CONSTANTS.PRESIGNED_DOWNLOAD_EXPIRY_SECONDS,
    );

    return {
      fileId,
      originalName: record.originalName,
      downloadUrl,
      downloadCount: newCount,
      expiresInSeconds: FILE_CONSTANTS.PRESIGNED_DOWNLOAD_EXPIRY_SECONDS,
    };
  }

  async deleteFile(fileId: string) {
    const record = await this.awsService.getFileRecord(fileId);
    if (!record) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    await this.awsService.deleteFile(fileId, record.s3Key);
    return {
      message: `File ${record.originalName} (${fileId}) deleted successfully`,
    };
  }
}
