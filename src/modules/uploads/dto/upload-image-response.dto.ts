import { ApiProperty } from '@nestjs/swagger';

export class UploadImageResponseDto {
  @ApiProperty({
    description: 'Cloudinary public ID for the uploaded image',
    example: 'ecommerce/products/sample-image',
  })
  publicId: string;

  @ApiProperty({
    description: 'Secure HTTPS URL of the uploaded image',
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/ecommerce/products/sample-image.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'Original uploaded file name',
    example: 'sample-image.jpg',
  })
  originalName: string;

  @ApiProperty({
    description: 'Uploaded file MIME type',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Uploaded file size in bytes',
    example: 123456,
  })
  size: number;

  @ApiProperty({
    description: 'Image width in pixels',
    example: 1200,
  })
  width: number;

  @ApiProperty({
    description: 'Image height in pixels',
    example: 800,
  })
  height: number;
}
