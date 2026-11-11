import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmUploadDto {
  @ApiPropertyOptional({
    description: 'Optional client-calculated MD5 or note',
    example: 'd41d8cd98f00b204e9800998ecf8427e',
  })
  @IsOptional()
  @IsString()
  clientChecksum?: string;
}

