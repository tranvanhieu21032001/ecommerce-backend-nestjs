import { Inject, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

type SalesDay = {
  date: string;
  revenue: number;
  paidOrders: number;
  itemsSold: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async analytics(days: number) {
    const cacheKey = `dashboard:analytics:v1:${days}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as unknown;
      }
    } catch {
      // Analytics remains available when the short-lived cache is unavailable.
    }

    const now = new Date();
    const from = this.startOfUtcDay(new Date(now.getTime() - (days - 1) * 86400000));
    const previousFrom = this.startOfUtcDay(new Date(from.getTime() - days * 86400000));

    const [payments, previousPayments, orderCounts, lowStockProducts] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: from, lte: now },
          order: { status: { not: OrderStatus.CANCELLED } },
        },
        select: {
          amount: true,
          paidAt: true,
          order: {
            select: {
              orderItems: {
                select: {
                  quantity: true,
                  productId: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: previousFrom, lt: from },
          order: { status: { not: OrderStatus.CANCELLED } },
        },
        select: { amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from, lte: now } },
        _count: { _all: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true, stock: { lte: 5 } },
        orderBy: [{ stock: 'asc' }, { name: 'asc' }],
        take: 5,
        select: { id: true, name: true, stock: true },
      }),
    ]);

    const series = this.initializeSeries(from, days);
    const byDate = new Map(series.map((day) => [day.date, day]));
    const products = new Map<string, { id: string; name: string; quantity: number }>();

    for (const payment of payments) {
      if (!payment.paidAt) {
        continue;
      }
      const point = byDate.get(this.dateKey(payment.paidAt));
      if (point) {
        point.revenue += Number(payment.amount);
        point.paidOrders += 1;
      }
      for (const item of payment.order.orderItems) {
        if (point) {
          point.itemsSold += item.quantity;
        }
        const current = products.get(item.productId);
        products.set(item.productId, {
          id: item.productId,
          name: item.product.name,
          quantity: (current?.quantity ?? 0) + item.quantity,
        });
      }
    }

    const revenue = this.roundMoney(
      payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    );
    const previousRevenue = this.roundMoney(
      previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    );
    const itemsSold = series.reduce((sum, point) => sum + point.itemsSold, 0);
    const response = {
      period: { days, from, to: now },
      summary: {
        revenue,
        paidOrders: payments.length,
        itemsSold,
        averageOrderValue: payments.length ? this.roundMoney(revenue / payments.length) : 0,
        revenueGrowth: this.growthRate(revenue, previousRevenue),
      },
      series: series.map((point) => ({ ...point, revenue: this.roundMoney(point.revenue) })),
      orderStatus: Object.values(OrderStatus).map((status) => ({
        status,
        count: orderCounts.find((entry) => entry.status === status)?._count._all ?? 0,
      })),
      topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      lowStockProducts,
      generatedAt: now,
      revenueBasis: 'COMPLETED_PAYMENT',
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
    } catch {
      // Cache writes must not break an admin report response.
    }

    return response;
  }

  private initializeSeries(from: Date, days: number): SalesDay[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(from.getTime() + index * 86400000);
      return { date: this.dateKey(date), revenue: 0, paidOrders: 0, itemsSold: 0 };
    });
  }

  private startOfUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private growthRate(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }
}
