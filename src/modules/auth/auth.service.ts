import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
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
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { OAuth2Client } from 'google-auth-library';

type RefreshAuthUser = {
  id: string;
  email: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

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
        status: true,
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

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;
    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      birthday: user.birthday,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    return {
      status: true,
      message: 'Login successful',
      user: safeUser,
      ...tokens,
    };
  }

  async loginWithGoogle(googleLoginDto: GoogleLoginDto): Promise<AuthResponseDto> {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      throw new InternalServerErrorException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleLoginDto.credential,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const email = payload.email.trim().toLowerCase();
    const now = new Date();
    const userByGoogleId = await this.prismaService.user.findUnique({
      where: { googleId: payload.sub },
    });

    let user = userByGoogleId;
    if (!user) {
      const userByEmail = await this.prismaService.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      });

      if (userByEmail?.googleId && userByEmail.googleId !== payload.sub) {
        throw new ConflictException('This email is already linked to another Google account');
      }

      if (userByEmail) {
        user = await this.prismaService.user.update({
          where: { id: userByEmail.id },
          data: {
            googleId: payload.sub,
            emailVerifiedAt: userByEmail.emailVerifiedAt ?? now,
          },
        });
      } else {
        const password = await argon2.hash(randomBytes(32).toString('hex'));
        user = await this.prismaService.user.create({
          data: {
            email,
            googleId: payload.sub,
            password,
            firstName: payload.given_name?.trim() || null,
            lastName: payload.family_name?.trim() || null,
            emailVerifiedAt: now,
          },
        });
      }
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      status: true,
      message: 'Google sign-in successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        birthday: user.birthday,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      ...tokens,
    };
  }

  async logout(logoutDto: LogoutDto): Promise<{ status: boolean; message: string }> {
    const { refreshToken } = logoutDto;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const activeSessions = await this.prismaService.userSession.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        refreshTokenHash: true,
      },
    });

    for (const session of activeSessions) {
      const isMatched = await argon2.verify(session.refreshTokenHash, refreshToken);
      if (isMatched) {
        await this.prismaService.userSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });

        return {
          status: true,
          message: 'Logout successful',
        };
      }
    }

    throw new UnauthorizedException('Session not found or already revoked');
  }

  async refreshTokens(refreshUser: RefreshAuthUser): Promise<AuthResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id: refreshUser.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        birthday: true,
        phoneNumber: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const activeSessions = await this.prismaService.userSession.findMany({
      where: {
        userId: refreshUser.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        refreshTokenHash: true,
      },
    });

    let matchedSessionId: string | null = null;
    for (const session of activeSessions) {
      if (await argon2.verify(session.refreshTokenHash, refreshUser.refreshToken)) {
        matchedSessionId = session.id;
        break;
      }
    }

    if (!matchedSessionId) {
      throw new UnauthorizedException('Session not found or already revoked');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    const sessionId = matchedSessionId;
    await this.prismaService.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });

      await this.storeRefreshToken(tx, user.id, tokens.refreshToken);
    });

    return {
      status: true,
      message: 'Token refreshed successfully',
      user,
      ...tokens,
    };
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

  async confirmEmail(token: string): Promise<{ status: boolean; message: string }> {
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

    return { status: true, message: 'Email verified successfully' };
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
