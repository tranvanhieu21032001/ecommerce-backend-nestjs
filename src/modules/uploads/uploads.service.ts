import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { UploadImageResponseDto } from './dto/upload-image-response.dto';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadImage(
    file: Express.Multer.File | undefined,
    folder = 'uploads',
  ): Promise<UploadImageResponseDto> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only jpeg, png, webp, and gif images are allowed');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Image size must not exceed 5MB');
    }

    this.ensureCloudinaryConfigured();

    const uploadResult = await this.uploadBuffer(file.buffer, this.normalizeFolder(folder));

    return {
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      width: uploadResult.width,
      height: uploadResult.height,
    };
  }

  private uploadBuffer(fileBuffer: Buffer, folder: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(new InternalServerErrorException(error.message));
            return;
          }

          if (!result) {
            reject(new InternalServerErrorException('Cloudinary upload failed'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(fileBuffer);
    });
  }

  private normalizeFolder(folder: string): string {
    const safeFolder = folder
      .trim()
      .toLowerCase()
      .replace(/\\/g, '/')
      .replace(/[^a-z0-9/_-]/g, '-')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');

    return safeFolder ? `ecommerce/${safeFolder}` : 'ecommerce/uploads';
  }

  private ensureCloudinaryConfigured(): void {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException('Cloudinary environment variables are not configured');
    }
  }
}
