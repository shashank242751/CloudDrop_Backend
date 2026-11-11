import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { AwsModule } from './aws/aws.module';
import { FilesModule } from './files/files.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    AppConfigModule,
    AwsModule,
    FilesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
