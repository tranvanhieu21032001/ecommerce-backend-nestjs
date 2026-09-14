import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({
    description: 'Unique coupon code',
    example: 'FLASH50',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({
    description: 'Coupon description',
    example: '50% off flash sale orders',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    description: 'Discount calculation type',
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
  })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    description: 'Discount value. Use 1-100 for percentage coupons.',
    example: 50,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountValue: number;

  @ApiPropertyOptional({
    description: 'Minimum order amount required to apply this coupon',
    example: 100,
    minimum: 0,
    default: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minOrderAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum discount amount for percentage coupons',
    example: 30,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Total number of times this coupon can be used',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'Coupon start date',
    example: '2026-05-24T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startsAt?: Date;

  @ApiPropertyOptional({
    description: 'Coupon expiration date',
    example: '2026-05-31T23:59:59.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Whether coupon is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
