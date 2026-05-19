import { ApiProperty } from '@nestjs/swagger';

class ProductTagResponseDto {
  @ApiProperty({
    description: 'Tag ID',
    example: 'tag-id-1',
  })
  id: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'Summer Sale',
  })
  name: string;

  @ApiProperty({
    description: 'Tag slug',
    example: 'summer-sale',
  })
  slug: string;
}

class ProductBrandResponseDto {
  @ApiProperty({
    description: 'Brand ID',
    example: 'brand-id-1',
  })
  id: string;

  @ApiProperty({
    description: 'Brand name',
    example: 'Apple',
  })
  name: string;

  @ApiProperty({
    description: 'Brand slug',
    example: 'apple',
  })
  slug: string;

  @ApiProperty({
    description: 'Brand logo URL',
    example: 'https://example.com/images/apple-logo.png',
    nullable: true,
  })
  logoUrl: string | null;
}

export class ProductResponseDto {
  @ApiProperty({
    description: 'Product ID',
    example: '46545646sds-4584s68sd-4654684sd',
  })
  id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Headphone',
  })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'High quality wireless headphones',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Product price',
    example: 99.99,
  })
  price: number;

  @ApiProperty({
    description: 'Product stock',
    example: 100,
  })
  stock: number;

  @ApiProperty({
    description: 'Stock keeping Unit',
    example: 'WH-001',
  })
  sku: string;

  @ApiProperty({
    description: 'Product image url',
    example: 'https://example.com/image.jpg',
  })
  imageUrl: string | null;

  @ApiProperty({
    description: 'Product category',
    example: 'Electronics',
  })
  category: string | null;

  @ApiProperty({
    description: 'Product brand',
    type: ProductBrandResponseDto,
    nullable: true,
  })
  brand: ProductBrandResponseDto | null;

  @ApiProperty({
    description: 'Product tags',
    type: [ProductTagResponseDto],
    required: false,
  })
  tags?: ProductTagResponseDto[];

  @ApiProperty({
    description: 'Product availability status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'last update timestamp',
  })
  updatedAt: Date;
}
