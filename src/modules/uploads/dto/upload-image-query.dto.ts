import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImageQueryDto {
  @ApiPropertyOptional({
    description: 'Cloudinary folder to upload the image into',
    example: 'products',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  folder?: string;
}
