import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto);
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
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
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
  async logout(@Body() logoutDto: LogoutDto): Promise<{ status: boolean; message: string }> {
    return await this.authService.logout(logoutDto);
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
