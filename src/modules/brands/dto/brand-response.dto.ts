import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The unique identifier of the brand',
  })
  id: string;

  @ApiProperty({
    example: 'Apple',
    description: 'The name of the brand',
  })
  name: string;

  @ApiProperty({
    example: 'Premium electronics and lifestyle products',
    description: 'A brief description of the brand',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'apple',
    description: 'The URL-friendly slug for the brand',
  })
  slug: string;

  @ApiProperty({
    example: 'https://example.com/images/apple-logo.png',
    description: 'URL of the brand logo',
    nullable: true,
  })
  logoUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Indicates if the brand is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: 25,
    description: 'Number of products in this brand',
  })
  productCount: number;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    description: 'The date and time when the brand was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-10T15:30:00Z',
    description: 'The date and time when the brand was last updated',
  })
  updatedAt: Date;
}
