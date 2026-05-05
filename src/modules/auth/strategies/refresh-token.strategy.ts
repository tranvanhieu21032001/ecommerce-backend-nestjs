import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon2 from 'argon2';

type RefreshTokenPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshTokenPayload) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const refreshToken = authHeader.slice(7).trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is empty after extraction');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const activeSessions = await this.prismaService.userSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        refreshTokenHash: true,
      },
    });

    let isValidSession = false;
    for (const session of activeSessions) {
      if (await argon2.verify(session.refreshTokenHash, refreshToken)) {
        isValidSession = true;
        break;
      }
    }

    if (!isValidSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { id: user.id, email: user.email, role: user.role, refreshToken };
  }
}
