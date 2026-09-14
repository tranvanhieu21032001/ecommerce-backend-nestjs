import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { ReserveFlashSaleItemDto } from './dto/reserve-flash-sale-item.dto';
import { FlashSalesService } from './flash-sales.service';

@ApiTags('flash-sales')
@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly flashSalesService: FlashSalesService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get currently active flash sale campaigns' })
  findActive() {
    return this.flashSalesService.findActive();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Create a flash sale campaign (Admin Only)' })
  create(@Body() dto: CreateFlashSaleDto) {
    return this.flashSalesService.create(dto);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({
    summary: 'Get persisted sales metrics for all flash sale campaigns (Admin Only)',
  })
  findReports() {
    return this.flashSalesService.findReports();
  }

  @Get(':id/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Get persisted sales metrics for a flash sale campaign (Admin Only)' })
  findReport(@Param('id') id: string) {
    return this.flashSalesService.findReport(id);
  }

  @Post('items/:itemId/reservations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-AUTH')
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 5, ttl: 10000 } })
  @ApiOperation({ summary: 'Atomically reserve flash sale stock before checkout' })
  reserve(
    @Param('itemId') itemId: string,
    @GetUser('id') userId: string,
    @Body() dto: ReserveFlashSaleItemDto,
  ) {
    return this.flashSalesService.reserve(itemId, userId, dto.quantity);
  }

  @Get('reservations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Get the authenticated customer flash sale reservation' })
  findReservation(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.flashSalesService.findReservation(id, userId);
  }
}
