import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

export interface FileRecord {
  fileId: string;
  originalName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'EXPIRED';
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

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'clouddrop-storage-demo');
    this.tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME', 'CloudDropFiles');

    // On EC2, AWS SDK automatically retrieves IAM Instance Profile role credentials
    // If local environment variables AWS_ACCESS_KEY_ID exist, it uses those
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    const clientConfig: any = { region };
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
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
  async generatePresignedUploadUrl(s3Key: string, mimeType: string, expiresInSeconds = 900): Promise<string> {
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
  async generatePresignedDownloadUrl(s3Key: string, originalName: string, expiresInSeconds = 300): Promise<string> {
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
    // Sort descending by uploadedAt
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
  async updateFileStatus(fileId: string, status: 'PENDING' | 'PROCESSING' | 'READY' | 'EXPIRED'): Promise<void> {
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
    // 1. Delete from S3
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      }),
    );

    // 2. Delete from DynamoDB
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { fileId },
      }),
    );
  }
}

