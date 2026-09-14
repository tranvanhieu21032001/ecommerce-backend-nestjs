import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'User Id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName: string | null;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName: string | null;

  @ApiProperty({
    description: 'User birthday',
    example: '2025-01-01T12:34:56.789Z',
  })
  birthday: Date | null;

  @ApiProperty({
    description: 'User phone number',
    example: '09xxxxxxxx',
  })
  phoneNumber: string | null;

  @ApiProperty({
    description: 'User role',
    enum: Role,
  })
  role: Role;

  @ApiProperty({
    description: 'User created at',
    example: '2025-01-01T12:34:56.789Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'User updated at',
    example: '2025-01-01T12:34:56.789Z',
  })
  updatedAt: Date;
}
