import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({
    description: 'Variant name',
    example: 'Wireless Headphones - Black',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Stock keeping unit for this variant',
    example: 'WH-001-BLK',
    maxLength: 50,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({
    description: 'Variant price in USD',
    example: 109.99,
    minimum: 0,
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    description: 'Variant stock quantity',
    example: 25,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @ApiProperty({
    description: 'Variant image URL',
    example: 'https://example.com/images/headphones-black.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    description: 'Variant attributes such as color, size, capacity, or material',
    example: {
      color: 'Black',
      size: 'M',
    },
    required: false,
    type: Object,
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;

  @ApiProperty({
    description: 'Whether variant is active and available for purchase',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
