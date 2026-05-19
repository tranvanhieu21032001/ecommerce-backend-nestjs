import { ApiProperty } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    example: '550e484-ere8458454-45erer4844858',
    description: 'The unique identifier of the tag',
  })
  id: string;

  @ApiProperty({
    example: 'Summer Sale',
    description: 'The name of the tag',
  })
  name: string;

  @ApiProperty({
    example: 'summer-sale',
    description: 'The URL-friendly slug for the tag',
    nullable: true,
  })
  slug: string | null;

  @ApiProperty({
    example: 'Seasonal promotion tag',
    description: 'A brief description of the tag',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: true,
    description: 'Indicates if the tag is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: 24,
    description: 'Number of products using this tag',
  })
  productCount: number;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    description: 'The date and time when the tag was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-10T15:30:00Z',
    description: 'The date and time when the tag was last updated',
  })
  updatedAt: Date;
}
