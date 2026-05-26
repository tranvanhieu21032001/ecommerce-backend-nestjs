import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Coupon,
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  FlashSaleReservationStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { FlashSalesService } from '../flash-sales/flash-sales.service';

type PurchaseItem = {
  productId: string;
  variationId?: string | null;
  quantity: number;
  salePrice?: Prisma.Decimal;
  flashSaleItemId?: string;
  flashSaleStockLimit?: number;
};

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    orderItems: true;
    payment: true;
  };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly flashSalesService: FlashSalesService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    const sources = [
      Boolean(createOrderDto.cartId),
      Boolean(createOrderDto.items?.length),
      Boolean(createOrderDto.flashSaleReservationId),
    ].filter(Boolean).length;
    if (sources !== 1) {
      throw new BadRequestException(
        'Provide exactly one of cartId, items, or flashSaleReservationId',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const items = await this.resolvePurchaseItems(tx, userId, createOrderDto);
      const products = await tx.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: {
          id: true,
          price: true,
          stock: true,
          isActive: true,
          productVariations: {
            where: { isActive: true },
            select: { id: true, price: true, stock: true },
          },
        },
      });

      if (products.length !== new Set(items.map((item) => item.productId)).size) {
        throw new NotFoundException('One or more products not found');
      }

      const orderItems = items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        if (!product.isActive) {
          throw new BadRequestException('One or more products are unavailable');
        }
        const variation = item.variationId
          ? product.productVariations.find((candidate) => candidate.id === item.variationId)
          : null;
        if (product.productVariations.length > 0 && !variation) {
          throw new BadRequestException('Select a product variation before checkout');
        }
        if (item.variationId && !variation) {
          throw new BadRequestException('Selected product variation is unavailable');
        }
        if (product.stock < item.quantity || (variation && variation.stock < item.quantity)) {
          throw new BadRequestException('Insufficient stock for one or more products');
        }

        return {
          productId: item.productId,
          variationId: variation?.id,
          flashSaleItemId: item.flashSaleItemId,
          quantity: item.quantity,
          price: item.salePrice ?? variation?.price ?? product.price,
        };
      });

      const subtotal = this.roundMoney(
        orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
      );
      const discountAmount = createOrderDto.couponCode
        ? await this.consumeCoupon(tx, createOrderDto.couponCode, subtotal)
        : 0;
      const shippingFee = 0;
      const taxAmount = 0;
      const totalAmount = this.roundMoney(subtotal + shippingFee + taxAmount - discountAmount);

      if (createOrderDto.paymentMethod === PaymentMethod.PAYOS && !Number.isInteger(totalAmount)) {
        throw new BadRequestException('PayOS VietQR payments require a whole-number VND amount');
      }

      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new BadRequestException('Insufficient stock for one or more products');
        }

        if (item.variationId) {
          const updatedVariation = await tx.productVariation.updateMany({
            where: {
              id: item.variationId,
              productId: item.productId,
              isActive: true,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });

          if (updatedVariation.count === 0) {
            throw new BadRequestException('Insufficient stock for selected variation');
          }
        }
      }

      if (createOrderDto.cartId) {
        const updatedCart = await tx.cart.updateMany({
          where: { id: createOrderDto.cartId, userId, checkedOut: false },
          data: { checkedOut: true },
        });

        if (updatedCart.count === 0) {
          throw new BadRequestException('Cart has already been checked out');
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          cartId: createOrderDto.cartId,
          subtotal: new Prisma.Decimal(subtotal),
          shippingFee: new Prisma.Decimal(shippingFee),
          discountAmount: new Prisma.Decimal(discountAmount),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          shippingName: createOrderDto.shippingName,
          shippingPhone: createOrderDto.shippingPhone,
          shippingAddressLine1: createOrderDto.shippingAddressLine1,
          shippingAddressLine2: createOrderDto.shippingAddressLine2,
          shippingWard: createOrderDto.shippingWard,
          shippingDistrict: createOrderDto.shippingDistrict,
          shippingCity: createOrderDto.shippingCity,
          shippingPostalCode: createOrderDto.shippingPostalCode,
          shippingCountry: createOrderDto.shippingCountry,
          notes: createOrderDto.notes,
          orderItems: {
            create: orderItems,
          },
          payment: {
            create: {
              amount: new Prisma.Decimal(totalAmount),
              method: createOrderDto.paymentMethod,
              currency: createOrderDto.paymentMethod === PaymentMethod.PAYOS ? 'VND' : undefined,
              userId,
            },
          },
        },
        include: this.orderInclude,
      });

      if (createOrderDto.flashSaleReservationId) {
        const flashItem = items[0];
        const consumed = await tx.flashSaleReservation.updateMany({
          where: {
            id: createOrderDto.flashSaleReservationId,
            userId,
            status: FlashSaleReservationStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
          data: {
            status: FlashSaleReservationStatus.CONSUMED,
            orderId: createdOrder.id,
          },
        });
        if (consumed.count === 0 || !flashItem.flashSaleItemId) {
          throw new BadRequestException('Flash sale reservation is no longer available');
        }
        const sold = await tx.flashSaleItem.updateMany({
          where: {
            id: flashItem.flashSaleItemId,
            soldCount: { lte: (flashItem.flashSaleStockLimit ?? 0) - flashItem.quantity },
          },
          data: {
            soldCount: { increment: flashItem.quantity },
            orderCount: { increment: 1 },
          },
        });
        if (sold.count === 0) {
          throw new BadRequestException('Flash sale item is unavailable');
        }
      }

      return createdOrder;
    });

    if (createOrderDto.flashSaleReservationId && order.orderItems[0]?.flashSaleItemId) {
      await this.flashSalesService.consumeReservation(
        order.orderItems[0].flashSaleItemId,
        createOrderDto.flashSaleReservationId,
      );
    }
    return this.formatOrder(order);
  }

  async findAll(
    userId: string,
    role: Role,
    queryDto: QueryOrderDto,
  ): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      status,
      userId: requestedUserId,
      search,
      createdFrom,
      createdTo,
      page,
      limit,
    } = queryDto;

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new BadRequestException('createdFrom must be before createdTo');
    }

    const where: Prisma.OrderWhereInput = {
      userId: role === Role.ADMIN ? requestedUserId : userId,
    };

    if (status) {
      where.status = status;
    }
    if (search?.trim()) {
      where.orderNumber = { contains: search.trim(), mode: 'insensitive' };
    }
    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      };
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.orderInclude,
      }),
    ]);

    return {
      data: orders.map((order) => this.formatOrder(order)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, role: Role): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        ...(role === Role.ADMIN ? {} : { userId }),
      },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.formatOrder(order);
  }

  async cancel(id: string, userId: string, role: Role): Promise<OrderResponseDto> {
    await this.paymentsService.cancelPendingPaymentLink(
      id,
      role === Role.ADMIN ? { role } : { role, userId },
    );
    return this.changeStatus(id, OrderStatus.CANCELLED, { userId, role });
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    if (updateOrderStatusDto.status === OrderStatus.CANCELLED) {
      await this.paymentsService.cancelPendingPaymentLink(id, { role: Role.ADMIN });
    }

    return this.changeStatus(id, updateOrderStatusDto.status);
  }

  private async changeStatus(
    id: string,
    nextStatus: OrderStatus,
    actor?: { userId: string; role: Role },
  ): Promise<OrderResponseDto> {
    const { updatedOrder, restoredFlashItems } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id,
          ...(actor && actor.role !== Role.ADMIN ? { userId: actor.userId } : {}),
        },
        include: this.orderInclude,
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (actor && nextStatus !== OrderStatus.CANCELLED) {
        throw new BadRequestException('Customers can only cancel an order');
      }
      if (order.status === nextStatus) {
        return { updatedOrder: order, restoredFlashItems: [] };
      }

      this.ensureStatusTransition(order.status, nextStatus, Boolean(actor));

      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: nextStatus,
          cancelledAt: nextStatus === OrderStatus.CANCELLED ? new Date() : undefined,
        },
      });

      if (result.count === 0) {
        throw new BadRequestException('Order status changed; please retry');
      }

      if (nextStatus === OrderStatus.CANCELLED) {
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        });

        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          if (item.variationId) {
            await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stock: { increment: item.quantity } },
            });
          }
          if (item.flashSaleItemId) {
            await tx.flashSaleItem.update({
              where: { id: item.flashSaleItemId },
              data: {
                soldCount: { decrement: item.quantity },
                orderCount: { decrement: 1 },
                ...(order.payment?.status === PaymentStatus.COMPLETED
                  ? { revenue: { decrement: item.price.mul(item.quantity) } }
                  : {}),
              },
            });
          }
        }
        await tx.flashSaleReservation.updateMany({
          where: { orderId: order.id, status: FlashSaleReservationStatus.CONSUMED },
          data: { status: FlashSaleReservationStatus.RELEASED },
        });
      }

      const currentOrder = await tx.order.findUnique({
        where: { id },
        include: this.orderInclude,
      });

      if (!currentOrder) {
        throw new NotFoundException('Order not found');
      }

      return {
        updatedOrder: currentOrder,
        restoredFlashItems:
          nextStatus === OrderStatus.CANCELLED
            ? currentOrder.orderItems
                .filter((item) => item.flashSaleItemId)
                .map((item) => ({
                  itemId: item.flashSaleItemId!,
                  quantity: item.quantity,
                  userId: currentOrder.userId,
                }))
            : [],
      };
    });

    await Promise.all(
      restoredFlashItems.map((item) =>
        this.flashSalesService.restorePurchasedStock(item.itemId, item.userId, item.quantity),
      ),
    );
    return this.formatOrder(updatedOrder);
  }

  private ensureStatusTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    isCustomerCancellation: boolean,
  ): void {
    if (isCustomerCancellation && currentStatus !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled by a customer');
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot update order status from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private async resolvePurchaseItems(
    tx: Prisma.TransactionClient,
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<PurchaseItem[]> {
    if (createOrderDto.flashSaleReservationId) {
      const reservation = await tx.flashSaleReservation.findFirst({
        where: {
          id: createOrderDto.flashSaleReservationId,
          userId,
          status: FlashSaleReservationStatus.ACTIVE,
          expiresAt: { gt: new Date() },
          flashSaleItem: {
            flashSale: {
              isActive: true,
              startsAt: { lte: new Date() },
              endsAt: { gt: new Date() },
            },
          },
        },
        include: { flashSaleItem: true },
      });
      if (!reservation) {
        throw new BadRequestException('Flash sale reservation is expired or unavailable');
      }
      return [
        {
          productId: reservation.flashSaleItem.productId,
          variationId: reservation.flashSaleItem.variationId,
          quantity: reservation.quantity,
          salePrice: reservation.flashSaleItem.salePrice,
          flashSaleItemId: reservation.flashSaleItemId,
          flashSaleStockLimit: reservation.flashSaleItem.stockLimit,
        },
      ];
    }

    if (createOrderDto.cartId) {
      const cart = await tx.cart.findFirst({
        where: { id: createOrderDto.cartId, userId, checkedOut: false },
        include: { cartItems: true },
      });

      if (!cart) {
        throw new NotFoundException('Active cart not found');
      }
      if (cart.cartItems.length === 0) {
        throw new BadRequestException('Cannot check out an empty cart');
      }

      return cart.cartItems.map((item) => ({
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
      }));
    }

    return this.mergeItems(createOrderDto.items ?? []);
  }

  private mergeItems(items: PurchaseItem[]): PurchaseItem[] {
    const quantityBySelection = new Map<string, PurchaseItem>();

    for (const item of items) {
      const key = `${item.productId}:${item.variationId ?? ''}`;
      const current = quantityBySelection.get(key);
      quantityBySelection.set(key, {
        productId: item.productId,
        variationId: item.variationId,
        quantity: (current?.quantity ?? 0) + item.quantity,
      });
    }

    return [...quantityBySelection.values()];
  }

  private async consumeCoupon(
    tx: Prisma.TransactionClient,
    couponCode: string,
    subtotal: number,
  ): Promise<number> {
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    this.ensureCouponCanApply(coupon, subtotal);

    if (coupon.usageLimit === null) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    } else {
      const reservedCoupon = await tx.coupon.updateMany({
        where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
        data: { usedCount: { increment: 1 } },
      });

      if (reservedCoupon.count === 0) {
        throw new BadRequestException('Coupon usage limit reached');
      }
    }

    const calculatedDiscount =
      coupon.discountType === DiscountType.PERCENTAGE
        ? subtotal * (Number(coupon.discountValue) / 100)
        : Number(coupon.discountValue);
    const cappedDiscount =
      coupon.maxDiscountAmount === null
        ? calculatedDiscount
        : Math.min(calculatedDiscount, Number(coupon.maxDiscountAmount));

    return this.roundMoney(Math.min(cappedDiscount, subtotal));
  }

  private ensureCouponCanApply(coupon: Coupon, subtotal: number): void {
    const now = new Date();

    if (!coupon.isActive || coupon.deletedAt) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon has not started yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (subtotal < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Order subtotal must be at least ${Number(coupon.minOrderAmount)} to use this coupon`,
      );
    }
  }

  private formatOrder(order: OrderWithRelations): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      userId: order.userId,
      cartId: order.cartId,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingWard: order.shippingWard,
      shippingDistrict: order.shippingDistrict,
      shippingCity: order.shippingCity,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      notes: order.notes,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        variationId: item.variationId,
        flashSaleItemId: item.flashSaleItemId,
        quantity: item.quantity,
        price: Number(item.price),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      payment: order.payment
        ? {
            id: order.payment.id,
            amount: Number(order.payment.amount),
            status: order.payment.status,
            method: order.payment.method,
            currency: order.payment.currency,
            transactionId: order.payment.transactionId,
            payosOrderCode:
              order.payment.payosOrderCode === null ? null : Number(order.payment.payosOrderCode),
            paymentLinkId: order.payment.paymentLinkId,
            checkoutUrl: order.payment.checkoutUrl,
            qrCode: order.payment.qrCode,
            expiresAt: order.payment.expiresAt,
            paidAt: order.payment.paidAt,
            createdAt: order.payment.createdAt,
            updatedAt: order.payment.updatedAt,
          }
        : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      cancelledAt: order.cancelledAt,
    };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private readonly orderInclude = {
    orderItems: true,
    payment: true,
  } satisfies Prisma.OrderInclude;
}
