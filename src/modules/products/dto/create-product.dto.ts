import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ProductVariationInputDto {
  @ApiProperty({
    description: 'Variant option IDs that make up this combination',
    example: ['color-yellow-id', 'size-m-id'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  variantIds: string[];

  @ApiProperty({
    description: 'Combination price',
    example: 5,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({
    description: 'Combination stock',
    example: 10,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiProperty({
    description: 'Combination SKU',
    example: 'TEE-YELLOW-M',
    required: false,
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    description: 'Whether this combination is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class ProductImageInputDto {
  @ApiProperty({
    description: 'Product image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({
    description: 'Image display order',
    example: 0,
    required: false,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({
    description: 'Whether this image is the primary product image',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Headphones',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Prodcut description',
    example: 'High-quality wireless headphoneswith noise cancellation',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Product price in USD',
    example: 99.99,
    minimum: 0,
  })
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({
    description: 'Stock quantity',
    example: 100,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiProperty({
    description: 'Stock keeping Unit (Sku) -unique identifier',
    example: 'WH-001',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiProperty({
    description: 'Product image url',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    description: 'Product gallery images',
    example: [
      {
        imageUrl: 'https://example.com/front.jpg',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        imageUrl: 'https://example.com/back.jpg',
        sortOrder: 1,
      },
    ],
    required: false,
    type: [ProductImageInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  @IsOptional()
  images?: ProductImageInputDto[];

  @ApiProperty({
    description: 'Product category',
    example: 'Electronics',
    required: true,
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    description: 'Product brand ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
    required: false,
  })
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiProperty({
    description: 'List of tag IDs assigned to the product',
    example: ['tag-id-1', 'tag-id-2'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @ApiProperty({
    description: 'Variant combinations assigned to the product',
    example: [
      {
        variantIds: ['color-yellow-id', 'size-m-id'],
        price: 5,
        stock: 10,
      },
    ],
    required: false,
    type: [ProductVariationInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariationInputDto)
  @IsOptional()
  variations?: ProductVariationInputDto[];

  @ApiProperty({
    description: 'Whether product is active and available for purchase',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
