import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@ApiTags('Files')
@Controller('api/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'Request a pre-signed S3 upload URL',
    description:
      'Creates a file metadata entry in DynamoDB and returns a secure, time-limited S3 pre-signed PUT URL. The client uploads the file directly to S3 without putting load on the backend server.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Pre-signed URL generated successfully',
  })
  async requestUploadUrl(@Body() dto: CreateUploadDto) {
    return this.filesService.requestUpload(dto);
  }

  @Post(':fileId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm direct S3 upload completion',
    description: 'Updates file status to READY in DynamoDB once S3 PUT upload succeeds.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique UUID of the file' })
  async confirmUpload(
    @Param('fileId') fileId: string,
    @Body() _dto: ConfirmUploadDto,
  ) {
    return this.filesService.confirmUpload(fileId);
  }

  @Get()
  @ApiOperation({
    summary: 'List all transferred files and metadata',
    description: 'Fetches active file transfer records stored in DynamoDB.',
  })
  async listFiles() {
    return this.filesService.listFiles();
  }

  @Get(':fileId')
  @ApiOperation({
    summary: 'Get details for a specific file transfer',
    description: 'Returns file metadata, size, download count, and expiration.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique UUID of the file' })
  async getFileDetails(@Param('fileId') fileId: string) {
    return this.filesService.getFileDetails(fileId);
  }

  @Get(':fileId/download-url')
  @ApiOperation({
    summary: 'Get a secure pre-signed download URL',
    description:
      'Increments the download counter in DynamoDB and generates a temporary pre-signed S3 GET URL.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique UUID of the file' })
  async getDownloadUrl(@Param('fileId') fileId: string) {
    return this.filesService.getDownloadUrl(fileId);
  }

  @Delete(':fileId')
  @ApiOperation({
    summary: 'Delete file from S3 and DynamoDB',
    description: 'Removes the object from the S3 bucket and deletes its record in DynamoDB.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique UUID of the file' })
  async deleteFile(@Param('fileId') fileId: string) {
    return this.filesService.deleteFile(fileId);
  }
}

