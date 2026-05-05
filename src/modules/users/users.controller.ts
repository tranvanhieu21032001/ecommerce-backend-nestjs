import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { getUser } from 'src/common/decorators/get-user.decorator';
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'The current user profile', type: UserResponseDto })
  getProfile(@getUser() user: UserResponseDto): UserResponseDto {
    return user;
  }
}
