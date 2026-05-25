import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product ID to purchase',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product to purchase',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'Cart ID to check out. Provide cartId or items when creating an order.',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsOptional()
  cartId?: string;

  @ApiPropertyOptional({
    description: 'Items to order directly when the order is not created from a cart',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @IsOptional()
  items?: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Coupon code to apply to the order',
    example: 'FLASH50',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Preferred payment method',
    enum: PaymentMethod,
    example: PaymentMethod.COD,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Recipient full name',
    example: 'Nguyen Van A',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  shippingName?: string;

  @ApiPropertyOptional({
    description: 'Recipient phone number',
    example: '+84901234567',
    maxLength: 30,
  })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  shippingPhone?: string;

  @ApiProperty({
    description: 'Primary shipping address line',
    example: '123 Nguyen Hue Street',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shippingAddressLine1: string;

  @ApiPropertyOptional({
    description: 'Additional shipping address details',
    example: 'Apartment 5B',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  shippingAddressLine2?: string;

  @ApiPropertyOptional({
    description: 'Shipping ward or commune',
    example: 'Ben Nghe',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  shippingWard?: string;

  @ApiPropertyOptional({
    description: 'Shipping district',
    example: 'District 1',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  shippingDistrict?: string;

  @ApiProperty({
    description: 'Shipping city or province',
    example: 'Ho Chi Minh City',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shippingCity: string;

  @ApiPropertyOptional({
    description: 'Shipping postal code',
    example: '700000',
    maxLength: 20,
  })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  shippingPostalCode?: string;

  @ApiPropertyOptional({
    description: 'Shipping country code',
    example: 'VN',
    default: 'VN',
    maxLength: 2,
  })
  @IsString()
  @MaxLength(2)
  @IsOptional()
  shippingCountry?: string;

  @ApiPropertyOptional({
    description: 'Customer notes for order fulfillment',
    example: 'Please call before delivery',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
