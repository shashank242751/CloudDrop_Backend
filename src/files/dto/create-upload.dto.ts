import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, Max } from 'class-validator';

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
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Hours until file expires (sets DynamoDB TTL). Default is 24 hours.',
    example: 24,
    default: 24,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168) // Max 7 days
  expiryHours?: number;

  @ApiPropertyOptional({
    description: 'Optional tags to categorize the file',
    example: ['project', 'specs'],
  })
  @IsOptional()
  tags?: string[];
}

