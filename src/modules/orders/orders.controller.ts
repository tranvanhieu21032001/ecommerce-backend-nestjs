import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
@ApiBearerAuth('JWT-AUTH')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for the authenticated customer' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid order, coupon, or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Cart or product not found' })
  async create(
    @GetUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.create(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get own orders, or all orders with filters for an administrator',
  })
  @ApiResponse({ status: 200, description: 'Orders fetched successfully' })
  async findAll(
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
    @Query() query: QueryOrderDto,
  ) {
    return await this.ordersService.findAll(userId, role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order accessible to the authenticated user' })
  @ApiResponse({ status: 200, description: 'Order fetched successfully', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.findOne(id, userId, role);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending order and restore its product stock' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Only pending orders can be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.cancel(id, userId, role);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an order fulfillment status (Admin Only)' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Order status updated', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid order status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.updateStatus(id, updateOrderStatusDto);
  }
}
