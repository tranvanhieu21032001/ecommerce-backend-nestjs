import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailsService } from 'src/common/mails/mails.service';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailsService: MailsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, phoneNumber, birthday } = registerDto;
    const existingUser = await this.prismaService.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    if (phoneNumber) {
      const existingPhoneNumber = await this.prismaService.user.findUnique({
        where: { phoneNumber },
      });
      if (existingPhoneNumber) {
        throw new ConflictException('Phone number already exists');
      }
    }

    try {
      const hashedPassword = await argon2.hash(password);
      const verificationToken = this.generateVerificationToken();
      const verificationTokenHash = this.hashVerificationToken(verificationToken);
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phoneNumber,
            birthday: birthday ? new Date(birthday) : undefined,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            birthday: true,
            role: true,
          },
        });
        const tokens = await this.generateTokens(user.id, user.email);
        await this.storeRefreshToken(tx, user.id, tokens.refreshToken);
        await tx.emailVerificationToken.create({
          data: {
            userId: user.id,
            tokenHash: verificationTokenHash,
            expiresAt: verificationExpiresAt,
          },
        });

        return { user, tokens };
      });

      await this.mailsService.sendConfirmationEmail(
        result.user.email,
        result.user.firstName ?? result.user.lastName ?? result.user.email,
        verificationToken,
      );

      return {
        message: 'Registration successful! Please check your email to verify your account!',
        user: result.user,
        ...result.tokens,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        const fields = Array.isArray(target)
          ? target.filter((item): item is string => typeof item === 'string')
          : [];

        if (fields.includes('email')) {
          throw new ConflictException('User already exists');
        }
        if (fields.includes('phoneNumber')) {
          throw new ConflictException('Phone number already exists');
        }
        throw new ConflictException('Duplicate data');
      }

      console.error('Error during user registration:', error);
      throw new InternalServerErrorException('An error occurred during registration');
    }
  }

  async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };
    const refreshId = randomBytes(16).toString('hex');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, refreshId },
        {
          expiresIn: '15m',
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      ),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.storeRefreshToken(this.prismaService, userId, refreshToken);
  }

  async confirmEmail(token: string): Promise<{ message: string }> {
    const tokenHash = this.hashVerificationToken(token);
    const now = new Date();

    const verificationToken = await this.prismaService.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken || verificationToken.consumedAt || verificationToken.expiresAt < now) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerifiedAt: now,
        },
      }),
      this.prismaService.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: {
          consumedAt: now,
        },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  private async storeRefreshToken(
    prisma: PrismaService | Prisma.TransactionClient,
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await argon2.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hashedRefreshToken,
        expiresAt,
      },
    });
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
