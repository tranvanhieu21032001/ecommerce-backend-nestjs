import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtRefreshAuthGuard } from 'src/common/guards/jwt-refresh-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private readonly accessTokenCookie = 'the-hole.access_token';
  private readonly refreshTokenCookie = 'the-hole.refresh_token';

  private buildCookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(this.accessTokenCookie, accessToken, this.buildCookieOptions(15 * 60 * 1000));
    res.cookie(
      this.refreshTokenCookie,
      refreshToken,
      this.buildCookieOptions(7 * 24 * 60 * 60 * 1000),
    );
  }

  private clearAuthCookies(res: Response) {
    const clearOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    res.clearCookie(this.accessTokenCookie, clearOptions);
    res.clearCookie(this.refreshTokenCookie, clearOptions);
  }

  private getCookie(req: Request, name: string) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    const value = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);

    return value ? decodeURIComponent(value) : undefined;
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'This endpoint allows a new user to register an account',
  })
  @ApiBody({
    type: RegisterDto,
    examples: {
      default: {
        value: {
          email: 'john.doe@example.com',
          password: 'StrongP@ssw0rd!',
          firstName: 'John',
          lastName: 'Doe',
          birthday: '1995-12-31',
          phoneNumber: '+84901234567',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Validation failed or user already exists',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'accessToken' | 'refreshToken'>> {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    return {
      status: result.status,
      message: result.message,
      user: result.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Logs in the user and returns access and refresh tokens',
  })
  @ApiBody({
    type: LoginDto,
  })
  @ApiResponse({ status: 200, description: 'User logged in successfully', type: AuthResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid email or password',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests. Rate limit exceeded',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'accessToken' | 'refreshToken'>> {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    return {
      status: result.status,
      message: result.message,
      user: result.user,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login or register with Google',
    description: 'Verifies a Google ID token and creates an authenticated session',
  })
  @ApiBody({
    type: GoogleLoginDto,
  })
  @ApiResponse({ status: 200, description: 'Google sign-in successful', type: AuthResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid Google credential',
  })
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'accessToken' | 'refreshToken'>> {
    const result = await this.authService.loginWithGoogle(googleLoginDto);
    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    return {
      status: result.status,
      message: result.message,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout user',
    description: 'Logs out the user by revoking the current refresh token session',
  })
  @ApiBody({
    type: LogoutDto,
  })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid refresh token or session not found',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() logoutDto: LogoutDto,
  ): Promise<{ status: boolean; message: string }> {
    const refreshToken = logoutDto?.refreshToken ?? this.getCookie(req, this.refreshTokenCookie);
    if (!refreshToken) {
      this.clearAuthCookies(res);
      return { status: true, message: 'Logout successful' };
    }

    const result = await this.authService.logout({ refreshToken });
    this.clearAuthCookies(res);
    return result;
  }

  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Validates refresh token and issues a new access/refresh token pair',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid refresh token',
  })
  async refresh(
    @GetUser()
    user: {
      id: string;
      email: string;
      role: string;
      refreshToken: string;
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'accessToken' | 'refreshToken'>> {
    const result = await this.authService.refreshTokens(user);
    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    return {
      status: result.status,
      message: result.message,
      user: result.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Returns the currently authenticated user based on the HttpOnly access cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async me(
    @GetUser()
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      birthday: Date | null;
      phoneNumber: string | null;
      role: string;
    },
  ) {
    return { status: true, message: 'Current user fetched successfully', user };
  }

  @Get('confirm')
  @ApiOperation({
    summary: 'Confirm user email',
    description: 'This endpoint verifies a user email by confirmation token',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  async confirmEmail(@Query('token') token: string): Promise<{ status: boolean; message: string }> {
    return await this.authService.confirmEmail(token);
  }
}
