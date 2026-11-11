const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'CloudDropFiles';

/**
 * AWS Lambda Trigger: Invoked by S3 ObjectCreated event
 */
exports.handler = async (event) => {
  console.log('Received S3 Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const objectSize = record.s3.object.size;
    const eTag = record.s3.object.eTag ? record.s3.object.eTag.replace(/"/g, '') : '';

    console.log(`Processing file: ${objectKey} from bucket: ${bucketName} (Size: ${objectSize} bytes, ETag: ${eTag})`);

    // Extract fileId from s3Key (convention: uploads/{fileId}/{fileName})
    const parts = objectKey.split('/');
    let fileId = null;
    if (parts.length >= 3 && parts[0] === 'uploads') {
      fileId = parts[1];
    }

    try {
      // Optional: Query HeadObject for metadata/content-type
      const headRes = await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        }),
      );

      const mimeType = headRes.ContentType || 'application/octet-stream';

      if (fileId) {
        // Update DynamoDB record directly
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { fileId },
            UpdateExpression: 'SET #st = :status, sizeBytes = :size, mimeType = :mime, processedMetadata = :meta',
            ExpressionAttributeNames: {
              '#st': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'READY',
              ':size': objectSize,
              ':mime': mimeType,
              ':meta': {
                md5Checksum: eTag,
                lambdaProcessedAt: new Date().toISOString(),
                previewGenerated: mimeType.startsWith('image/'),
              },
            },
          }),
        );
        console.log(`Successfully updated DynamoDB record for fileId: ${fileId}`);
      } else {
        console.warn(`Could not determine fileId from key: ${objectKey}`);
      }
    } catch (err) {
      console.error(`Error processing S3 object ${objectKey}:`, err);
      throw err;
    }
  }

  return { statusCode: 200, body: 'File processing completed' };
};

