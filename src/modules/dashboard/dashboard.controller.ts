import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { QueryDashboardAnalyticsDto } from './dto/query-dashboard-analytics.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-AUTH')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('analytics')
  @ApiOperation({
    summary: 'Get paid sales and revenue analytics for dashboard charts (Admin Only)',
  })
  analytics(@Query() query: QueryDashboardAnalyticsDto) {
    return this.dashboardService.analytics(query.days);
  }
}
