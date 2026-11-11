import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get(AppConfigService);

  // Configure CORS using centralized config
  app.enableCors({
    origin: appConfig.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: appConfig.corsCredentials,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger OpenAPI Setup
  const config = new DocumentBuilder()
    .setTitle('CloudDrop API')
    .setDescription(
      'CloudDrop: Cloud-Native Intelligent File Transfer Platform API powered by AWS S3, DynamoDB, Lambda, and EC2 Auto Scaling.',
    )
    .setVersion('1.0')
    .addTag('Files', 'Operations related to file upload, download, and metadata management')
    .addTag('Health', 'Health check endpoints for NLB and Auto Scaling')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'CloudDrop API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = appConfig.port;
  await app.listen(port);
  console.log(`CloudDrop Backend running in [${appConfig.nodeEnv}] mode on port ${port}`);
  console.log(`Allowed CORS origins: ${JSON.stringify(appConfig.corsOrigins)}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
