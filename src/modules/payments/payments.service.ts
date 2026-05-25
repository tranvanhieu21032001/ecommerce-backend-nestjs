import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { CreatePaymentLinkResponse, PayOS, Webhook, WebhookData } from '@payos/node';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePayOSPaymentLinkDto } from './dto/create-payos-payment-link.dto';
import { PayOSPaymentLinkResponseDto } from './dto/payos-payment-link-response.dto';
import { PayOSWebhookDto } from './dto/payos-webhook.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createPaymentLink(
    orderId: string,
    userId: string,
    role: Role,
    dto: CreatePayOSPaymentLinkDto,
  ): Promise<PayOSPaymentLinkResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(role === Role.ADMIN ? {} : { userId }),
      },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!order.payment || order.payment.method !== PaymentMethod.PAYOS) {
      throw new BadRequestException('Order does not use PayOS as its payment method');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be paid');
    }
    if (order.payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order has already been paid');
    }
    if (
      order.payment.checkoutUrl &&
      order.payment.qrCode &&
      order.payment.paymentLinkId &&
      order.payment.payosOrderCode !== null &&
      order.payment.payosBin &&
      order.payment.payosAccountNumber &&
      order.payment.payosAccountName
    ) {
      return {
        bin: order.payment.payosBin,
        accountNumber: order.payment.payosAccountNumber,
        accountName: order.payment.payosAccountName,
        amount: Number(order.payment.amount),
        description: this.createDescription(order.orderNumber),
        orderCode: Number(order.payment.payosOrderCode),
        currency: order.payment.currency,
        paymentLinkId: order.payment.paymentLinkId,
        status: 'PENDING',
        expiredAt: order.payment.expiresAt
          ? Math.floor(order.payment.expiresAt.getTime() / 1000)
          : undefined,
        checkoutUrl: order.payment.checkoutUrl,
        qrCode: order.payment.qrCode,
      };
    }

    const amount = this.toPayOSAmount(order.payment.amount);
    const orderCode =
      order.payment.payosOrderCode === null
        ? await this.reserveOrderCode(order.payment.id)
        : Number(order.payment.payosOrderCode);
    const payos = this.createClient();
    let paymentLink: CreatePaymentLinkResponse;

    try {
      paymentLink = await payos.paymentRequests.create({
        orderCode,
        amount,
        description: this.createDescription(order.orderNumber),
        cancelUrl: dto.cancelUrl,
        returnUrl: dto.returnUrl,
        expiredAt: dto.expiredAt,
      });
    } catch {
      throw new BadRequestException('Unable to create PayOS payment link');
    }

    await this.prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        currency: 'VND',
        payosOrderCode: BigInt(paymentLink.orderCode),
        paymentLinkId: paymentLink.paymentLinkId,
        payosBin: paymentLink.bin,
        payosAccountNumber: paymentLink.accountNumber,
        payosAccountName: paymentLink.accountName,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        expiresAt: paymentLink.expiredAt ? new Date(paymentLink.expiredAt * 1000) : null,
      },
    });

    return paymentLink;
  }

  async handleWebhook(webhookDto: PayOSWebhookDto): Promise<{ success: boolean }> {
    let webhookData: WebhookData;

    try {
      webhookData = await this.createClient().webhooks.verify(webhookDto as unknown as Webhook);
    } catch {
      throw new BadRequestException('Invalid PayOS webhook signature');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { payosOrderCode: BigInt(webhookData.orderCode) },
      include: { order: true },
    });

    // PayOS sends a test payload while confirming a webhook URL.
    if (!payment) {
      return { success: true };
    }
    if (payment.paymentLinkId && payment.paymentLinkId !== webhookData.paymentLinkId) {
      throw new BadRequestException('Payment link does not match this order');
    }
    if (Number(payment.amount) !== webhookData.amount || webhookData.currency !== 'VND') {
      throw new BadRequestException('Payment amount or currency does not match this order');
    }
    if (webhookData.code !== '00') {
      return { success: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          transactionId: webhookData.reference,
          paidAt: new Date(),
        },
      });

      await tx.order.updateMany({
        where: { id: payment.orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PROCESSING },
      });
    });

    return { success: true };
  }

  async cancelPendingPaymentLink(
    orderId: string,
    actor: { role: typeof Role.ADMIN } | { role: typeof Role.USER; userId: string },
  ): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(actor.role === Role.ADMIN ? {} : { userId: actor.userId }),
      },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (
      order.payment?.method !== PaymentMethod.PAYOS ||
      order.payment.status !== PaymentStatus.PENDING ||
      !order.payment.paymentLinkId
    ) {
      return;
    }

    try {
      await this.createClient().paymentRequests.cancel(
        order.payment.paymentLinkId,
        'Order cancelled',
      );
    } catch {
      throw new BadRequestException('Unable to cancel pending PayOS payment link');
    }
  }

  async confirmWebhook(webhookUrl: string) {
    try {
      return await this.createClient().webhooks.confirm(webhookUrl);
    } catch {
      throw new BadRequestException('Unable to register PayOS webhook URL');
    }
  }

  private async reserveOrderCode(paymentId: string): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderCode = Date.now() * 100 + Math.floor(Math.random() * 100);

      try {
        const result = await this.prisma.payment.updateMany({
          where: { id: paymentId, payosOrderCode: null },
          data: { payosOrderCode: BigInt(orderCode) },
        });

        if (result.count === 1) {
          return orderCode;
        }

        const existingPayment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          select: { payosOrderCode: true },
        });

        if (
          existingPayment?.payosOrderCode !== null &&
          existingPayment?.payosOrderCode !== undefined
        ) {
          return Number(existingPayment.payosOrderCode);
        }
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }
    }

    throw new InternalServerErrorException('Unable to allocate a PayOS order code');
  }

  private createClient(): PayOS {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');

    if (!clientId || !apiKey || !checksumKey) {
      throw new InternalServerErrorException('PayOS environment variables are not configured');
    }

    return new PayOS({ clientId, apiKey, checksumKey });
  }

  private toPayOSAmount(amount: Prisma.Decimal): number {
    const value = Number(amount);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BadRequestException('PayOS requires a positive whole-number VND amount');
    }

    return value;
  }

  private createDescription(orderNumber: string): string {
    return `ORDER ${orderNumber.slice(-18)}`;
  }
}
