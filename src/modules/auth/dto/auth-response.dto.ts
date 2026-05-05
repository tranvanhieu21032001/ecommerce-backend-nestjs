import { Role } from '@prisma/client';

export class AuthResponseDto {
  message: string;
  accessToken: string;
  refreshToken: string;
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
