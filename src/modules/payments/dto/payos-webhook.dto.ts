import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PayOSWebhookDto {
  @ApiProperty({ example: '00' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'success' })
  @IsString()
  desc: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  success?: boolean;

  @ApiProperty({ type: Object })
  @IsObject()
  data: object;

  @ApiProperty({ description: 'Signature PayOS uses to authenticate the payload' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
