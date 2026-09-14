import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class ConfirmPayOSWebhookDto {
  @ApiProperty({
    description: 'Public URL PayOS will use to notify completed VietQR transfers',
    example: 'https://api.example.com/api/v1/payments/payos/webhook',
  })
  @IsUrl()
  webhookUrl: string;
}
