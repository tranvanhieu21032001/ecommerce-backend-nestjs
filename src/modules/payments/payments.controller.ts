import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ConfirmPayOSWebhookDto } from './dto/confirm-payos-webhook.dto';
import { CreatePayOSPaymentLinkDto } from './dto/create-payos-payment-link.dto';
import { PayOSPaymentLinkResponseDto } from './dto/payos-payment-link-response.dto';
import { PayOSWebhookDto } from './dto/payos-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments/payos')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:orderId/payment-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Create a PayOS VietQR payment link for an order' })
  @ApiBody({ type: CreatePayOSPaymentLinkDto })
  @ApiResponse({
    status: 201,
    description: 'VietQR payment link created successfully',
    type: PayOSPaymentLinkResponseDto,
  })
  @ApiResponse({ status: 400, description: 'The order cannot be paid using PayOS' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async createPaymentLink(
    @Param('orderId') orderId: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
    @Body() dto: CreatePayOSPaymentLinkDto,
  ): Promise<PayOSPaymentLinkResponseDto> {
    return await this.paymentsService.createPaymentLink(orderId, userId, role, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive and verify PayOS payment webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payment data' })
  async webhook(@Body() webhookDto: PayOSWebhookDto): Promise<{ success: boolean }> {
    return await this.paymentsService.handleWebhook(webhookDto);
  }

  @Post('webhook/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Register a PayOS webhook URL (Admin Only)' })
  @ApiBody({ type: ConfirmPayOSWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook registered successfully' })
  async confirmWebhook(@Body() dto: ConfirmPayOSWebhookDto) {
    return await this.paymentsService.confirmWebhook(dto.webhookUrl);
  }
}
