import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('port', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('nodeEnv', 'development');
  }

  get isProduction(): boolean {
    return this.configService.get<boolean>('isProduction', false);
  }

  get frontendUrl(): string {
    return this.configService.get<string>('frontendUrl', '*');
  }

  get corsOrigins(): string | string[] {
    return this.configService.get('cors.origin', '*');
  }

  get corsCredentials(): boolean {
    return this.configService.get<boolean>('cors.credentials', true);
  }

  get awsRegion(): string {
    return this.configService.get<string>('aws.region', 'us-east-1');
  }

  get s3BucketName(): string {
    return this.configService.get<string>('aws.s3BucketName', 'clouddrop-storage-demo');
  }

  get dynamoDbTableName(): string {
    return this.configService.get<string>('aws.dynamoDbTableName', 'CloudDropFiles');
  }

  get awsCredentials(): { accessKeyId?: string; secretAccessKey?: string } | undefined {
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    if (accessKeyId && secretAccessKey) {
      return { accessKeyId, secretAccessKey };
    }
    // Return undefined when running on EC2 with IAM Instance Profile
    return undefined;
  }
}

