import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUrl, Min } from 'class-validator';

export class CreatePayOSPaymentLinkDto {
  @ApiProperty({
    description: 'Frontend URL PayOS redirects to after a successful payment',
    example: 'http://localhost:3000/checkout/success',
  })
  @IsUrl({ require_tld: false })
  returnUrl: string;

  @ApiProperty({
    description: 'Frontend URL PayOS redirects to when payment is cancelled',
    example: 'http://localhost:3000/checkout/cancel',
  })
  @IsUrl({ require_tld: false })
  cancelUrl: string;

  @ApiPropertyOptional({
    description: 'Unix timestamp in seconds after which the payment link expires',
    example: 1780000000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  expiredAt?: number;
}
