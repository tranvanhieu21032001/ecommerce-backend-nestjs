import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { MailsModule } from 'src/common/mails/mails.module';

@Module({
  imports: [
    PrismaModule,
    MailsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtExpiresIn = (configService.get<string>('JWT_EXPIRES_IN') || '900s') as StringValue;
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: { expiresIn: jwtExpiresIn },
        };
      },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
