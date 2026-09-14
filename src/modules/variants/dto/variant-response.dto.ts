import { ApiProperty } from '@nestjs/swagger';

export class VariantResponseDto {
  @ApiProperty({
    description: 'Variant ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Variant name',
    example: 'Wireless Headphones - Black',
  })
  name: string;

  @ApiProperty({
    description: 'Variant SKU',
    example: 'WH-001-BLK',
  })
  sku: string;

  @ApiProperty({
    description: 'Variant price',
    example: 109.99,
  })
  price: number;

  @ApiProperty({
    description: 'Variant stock',
    example: 25,
  })
  stock: number;

  @ApiProperty({
    description: 'Variant image URL',
    example: 'https://example.com/images/headphones-black.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    description: 'Variant attributes such as color, size, capacity, or material',
    example: {
      color: 'Black',
      size: 'M',
    },
  })
  attributes: Record<string, unknown>;

  @ApiProperty({
    description: 'Variant availability status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
