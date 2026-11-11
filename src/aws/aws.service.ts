import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { AppConfigService } from '../config';
import { FileStatus, FILE_CONSTANTS } from '../constants';

export interface FileRecord {
  fileId: string;
  originalName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  uploadedAt: string;
  expiresAt: number; // Unix timestamp in seconds for DynamoDB TTL
  downloadCount: number;
  tags?: string[];
  processedMetadata?: {
    md5Checksum?: string;
    previewGenerated?: boolean;
    lambdaProcessedAt?: string;
  };
}

@Injectable()
export class AwsService {
  private readonly logger = new Logger(AwsService.name);
  private readonly s3Client: S3Client;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly bucketName: string;
  private readonly tableName: string;

  constructor(private readonly appConfigService: AppConfigService) {
    const region = this.appConfigService.awsRegion;
    this.bucketName = this.appConfigService.s3BucketName;
    this.tableName = this.appConfigService.dynamoDbTableName;

    // Use credentials from config if provided (e.g. local dev);
    // Otherwise AWS SDK automatically retrieves IAM Instance Profile on EC2
    const credentials = this.appConfigService.awsCredentials;
    const clientConfig: any = { region };
    if (credentials) {
      clientConfig.credentials = credentials;
    }

    this.s3Client = new S3Client(clientConfig);

    const ddbClient = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });

    this.logger.log(`Initialized AWS Service for Region: ${region}, Bucket: ${this.bucketName}, Table: ${this.tableName}`);
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getTableName(): string {
    return this.tableName;
  }

  /**
   * Generates a pre-signed S3 PUT URL for secure, direct client-to-S3 uploads.
   * This offloads heavy file uploads from EC2, saving bandwidth and compute.
   */
  async generatePresignedUploadUrl(
    s3Key: string,
    mimeType: string,
    expiresInSeconds = FILE_CONSTANTS.PRESIGNED_UPLOAD_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Generates a pre-signed S3 GET URL for direct, secure file downloads.
   */
  async generatePresignedDownloadUrl(
    s3Key: string,
    originalName: string,
    expiresInSeconds = FILE_CONSTANTS.PRESIGNED_DOWNLOAD_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Save file record in DynamoDB
   */
  async saveFileRecord(record: FileRecord): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
      }),
    );
  }

  /**
   * Get file record from DynamoDB by fileId
   */
  async getFileRecord(fileId: string): Promise<FileRecord | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { fileId },
      }),
    );
    return (result.Item as FileRecord) || null;
  }

  /**
   * List all file records from DynamoDB
   */
  async listFileRecords(): Promise<FileRecord[]> {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
      }),
    );
    const items = (result.Items as FileRecord[]) || [];
    return items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  /**
   * Increments download counter in DynamoDB atomically
   */
  async incrementDownloadCount(fileId: string): Promise<number> {
    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { fileId },
        UpdateExpression: 'SET downloadCount = if_not_exists(downloadCount, :zero) + :incr',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':incr': 1,
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return result.Attributes?.downloadCount || 1;
  }

  /**
   * Mark file status in DynamoDB
   */
  async updateFileStatus(fileId: string, status: FileStatus): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { fileId },
        UpdateExpression: 'SET #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': status },
      }),
    );
  }

  /**
   * Delete file from S3 and DynamoDB
   */
  async deleteFile(fileId: string, s3Key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      }),
    );

    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { fileId },
      }),
    );
  }
}
