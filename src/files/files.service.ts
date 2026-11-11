import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AwsService, FileRecord } from '../aws/aws.service';
import { CreateUploadDto } from './dto/create-upload.dto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly awsService: AwsService) {}

  async requestUpload(dto: CreateUploadDto) {
    const fileId = uuidv4();
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/${fileId}/${sanitizedFileName}`;

    const expiryHours = dto.expiryHours || 24;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = nowSeconds + expiryHours * 3600;

    // 1. Generate pre-signed PUT URL (valid for 15 minutes)
    const uploadUrl = await this.awsService.generatePresignedUploadUrl(s3Key, dto.mimeType, 900);

    // 2. Register metadata record in DynamoDB with PENDING status
    const record: FileRecord = {
      fileId,
      originalName: dto.fileName,
      s3Key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      status: 'PENDING',
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

    // Set status to READY (or PROCESSING until Lambda confirms)
    await this.awsService.updateFileStatus(fileId, 'READY');
    return {
      message: 'File upload confirmed successfully',
      fileId,
      status: 'READY',
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

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (record.expiresAt && record.expiresAt < nowSeconds) {
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
      300,
    );

    return {
      fileId,
      originalName: record.originalName,
      downloadUrl,
      downloadCount: newCount,
      expiresInSeconds: 300,
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

