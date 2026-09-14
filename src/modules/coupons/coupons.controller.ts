import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CouponResponseDto } from './dto/coupon-response.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { ValidateCouponResponseDto } from './dto/validate-coupon-response.dto';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Create a new coupon' })
  @ApiBody({ type: CreateCouponDto })
  @ApiResponse({ status: 201, description: 'Coupon created successfully', type: CouponResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Coupon already exists' })
  async create(@Body() createCouponDto: CreateCouponDto): Promise<CouponResponseDto> {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Get coupons with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Coupons fetched successfully' })
  async findAll(@Query() query: QueryCouponDto) {
    return this.couponsService.findAll(query);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code against an order subtotal' })
  @ApiBody({ type: ValidateCouponDto })
  @ApiResponse({
    status: 200,
    description: 'Coupon validated successfully',
    type: ValidateCouponResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Coupon cannot be applied' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async validate(@Body() validateCouponDto: ValidateCouponDto): Promise<ValidateCouponResponseDto> {
    return this.couponsService.validate(validateCouponDto);
  }

  @Get('code/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Get coupon by code' })
  @ApiResponse({ status: 200, description: 'Coupon fetched successfully', type: CouponResponseDto })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findByCode(@Param('code') code: string): Promise<CouponResponseDto> {
    return this.couponsService.findByCode(code);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Get coupon by id' })
  @ApiResponse({ status: 200, description: 'Coupon fetched successfully', type: CouponResponseDto })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findOne(@Param('id') id: string): Promise<CouponResponseDto> {
    return this.couponsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Update coupon by id' })
  @ApiBody({ type: UpdateCouponDto })
  @ApiResponse({ status: 200, description: 'Coupon updated successfully', type: CouponResponseDto })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiResponse({ status: 409, description: 'Coupon already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateCouponDto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Delete coupon by id' })
  @ApiResponse({ status: 200, description: 'Coupon deleted successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.couponsService.remove(id);
  }
}
