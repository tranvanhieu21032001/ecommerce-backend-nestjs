import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

type PurchaseItem = {
  productId: string;
  quantity: number;
};

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    orderItems: true;
    payment: true;
  };
}>;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    if (Boolean(createOrderDto.cartId) === Boolean(createOrderDto.items?.length)) {
      throw new BadRequestException('Provide either cartId or items to create an order');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const items = await this.resolvePurchaseItems(tx, userId, createOrderDto);
      const products = await tx.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: { id: true, price: true, stock: true, isActive: true },
      });

      if (products.length !== items.length) {
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
        if (product.stock < item.quantity) {
          throw new BadRequestException('Insufficient stock for one or more products');
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
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

      return tx.order.create({
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
              userId,
            },
          },
        },
        include: this.orderInclude,
      });
    });

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
    return this.changeStatus(id, OrderStatus.CANCELLED, { userId, role });
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.changeStatus(id, updateOrderStatusDto.status);
  }

  private async changeStatus(
    id: string,
    nextStatus: OrderStatus,
    actor?: { userId: string; role: Role },
  ): Promise<OrderResponseDto> {
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
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
        return order;
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
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      const currentOrder = await tx.order.findUnique({
        where: { id },
        include: this.orderInclude,
      });

      if (!currentOrder) {
        throw new NotFoundException('Order not found');
      }

      return currentOrder;
    });

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
        quantity: item.quantity,
      }));
    }

    return this.mergeItems(createOrderDto.items ?? []);
  }

  private mergeItems(items: PurchaseItem[]): PurchaseItem[] {
    const quantityByProduct = new Map<string, number>();

    for (const item of items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    return [...quantityByProduct.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
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
