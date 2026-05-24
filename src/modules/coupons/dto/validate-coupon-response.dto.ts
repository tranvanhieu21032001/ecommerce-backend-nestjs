import { ApiProperty } from '@nestjs/swagger';
import { CouponResponseDto } from './coupon-response.dto';

export class ValidateCouponResponseDto {
  @ApiProperty()
  valid: boolean;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  finalAmount: number;

  @ApiProperty({ type: CouponResponseDto })
  coupon: CouponResponseDto;
}
