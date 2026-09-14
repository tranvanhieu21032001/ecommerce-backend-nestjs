import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty({
    example: true,
  })
  status: boolean;

  @ApiProperty({
    example: 'Login successful',
  })
  message: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Access token returned for backward compatibility',
  })
  accessToken?: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token returned for backward compatibility',
  })
  refreshToken?: string;

  @ApiProperty({
    type: Object,
  })
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    birthday: Date | null;
    phoneNumber: string | null;
    role: Role;
  };
}
