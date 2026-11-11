import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, Max } from 'class-validator';
import { FILE_CONSTANTS } from '../../constants';

export class CreateUploadDto {
  @ApiProperty({
    description: 'Original name of the file to be uploaded',
    example: 'architecture-diagram.png',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/png',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'Size of the file in bytes',
    example: 1048576,
  })
  @IsNumber()
  @Min(1)
  @Max(FILE_CONSTANTS.MAX_FILE_SIZE_BYTES)
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Hours until file expires (sets DynamoDB TTL). Default is 24 hours.',
    example: 24,
    default: FILE_CONSTANTS.DEFAULT_EXPIRY_HOURS,
  })
  @IsOptional()
  @IsNumber()
  @Min(FILE_CONSTANTS.MIN_EXPIRY_HOURS)
  @Max(FILE_CONSTANTS.MAX_EXPIRY_HOURS)
  expiryHours?: number;

  @ApiPropertyOptional({
    description: 'Optional tags to categorize the file',
    example: ['project', 'specs'],
  })
  @IsOptional()
  tags?: string[];
}
