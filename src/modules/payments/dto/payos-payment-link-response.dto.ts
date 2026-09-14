import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayOSPaymentLinkResponseDto {
  @ApiProperty({ description: 'PayOS bank BIN used for VietQR', example: '970422' })
  bin: string;

  @ApiProperty({ description: 'Receiving bank account number', example: '123456789' })
  accountNumber: string;

  @ApiProperty({ description: 'Receiving account holder name', example: 'CONG TY ABC' })
  accountName: string;

  @ApiProperty({ description: 'Amount payable in VND', example: 250000 })
  amount: number;

  @ApiProperty({ description: 'Bank transfer content', example: 'ORDER ABC123' })
  description: string;

  @ApiProperty({ description: 'Numeric PayOS order code', example: 174817440000001 })
  orderCode: number;

  @ApiProperty({ description: 'Currency of the VietQR payment', example: 'VND' })
  currency: string;

  @ApiProperty({ description: 'PayOS payment link identifier' })
  paymentLinkId: string;

  @ApiProperty({ description: 'Current PayOS link status', example: 'PENDING' })
  status: string;

  @ApiPropertyOptional({ description: 'Unix timestamp when this payment link expires' })
  expiredAt?: number;

  @ApiProperty({ description: 'Hosted PayOS checkout page URL' })
  checkoutUrl: string;

  @ApiProperty({ description: 'VietQR data payload for client-side QR rendering' })
  qrCode: string;
}
