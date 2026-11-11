import { APP_CONSTANTS } from '../constants';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  frontendUrl: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  aws: {
    region: string;
    s3BucketName: string;
    dynamoDbTableName: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const frontendUrl = process.env.FRONTEND_URL || '*';

  return {
    port: parseInt(process.env.PORT, 10) || APP_CONSTANTS.DEFAULT_PORT,
    nodeEnv,
    isProduction: nodeEnv === 'production',
    frontendUrl,
    cors: {
      origin: frontendUrl === '*' ? '*' : frontendUrl.split(',').map((url) => url.trim()),
      credentials: true,
    },
    aws: {
      region: process.env.AWS_REGION || APP_CONSTANTS.DEFAULT_AWS_REGION,
      s3BucketName: process.env.S3_BUCKET_NAME || APP_CONSTANTS.DEFAULT_S3_BUCKET,
      dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME || APP_CONSTANTS.DEFAULT_DYNAMODB_TABLE,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
    },
  };
};

