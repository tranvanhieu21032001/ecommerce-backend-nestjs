import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FlashSaleReservationStatus, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFlashSaleDto, CreateFlashSaleItemDto } from './dto/create-flash-sale.dto';

const reservationSeconds = 10 * 60;
const catalogKey = 'flash-sales:active:v1';
const staleCatalogKey = `${catalogKey}:stale`;

type FlashSaleItemRecord = Prisma.FlashSaleItemGetPayload<{
  include: {
    flashSale: true;
    product: { include: { productImages: true } };
    variation: { include: { options: { include: { variant: true } } } };
  };
}>;

type FlashSaleReportRecord = Prisma.FlashSaleGetPayload<{
  include: {
    items: {
      include: {
        flashSale: true;
        product: { include: { productImages: true } };
        variation: { include: { options: { include: { variant: true } } } };
      };
    };
  };
}>;

type CachedCatalogItem = {
  id: string;
  stockLimit: number;
  soldCount: number;
  [key: string]: unknown;
};

type CachedCatalogSale = {
  items: CachedCatalogItem[];
  [key: string]: unknown;
};

@Injectable()
export class FlashSalesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async create(dto: CreateFlashSaleDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException('Flash sale start time must be before end time');
    }

    await Promise.all(dto.items.map((item) => this.validateSaleItem(item)));
    const selections = dto.items.map((item) => `${item.productId}:${item.variationId ?? ''}`);
    if (new Set(selections).size !== selections.length) {
      throw new BadRequestException('A product selection can only appear once in a campaign');
    }

    const sale = await this.prisma.flashSale.create({
      data: {
        name: dto.name.trim(),
        startsAt,
        endsAt,
        isActive: dto.isActive ?? true,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId,
            salePrice: new Prisma.Decimal(item.salePrice),
            stockLimit: item.stockLimit,
            perUserLimit: item.perUserLimit ?? 1,
          })),
        },
      },
      include: { items: true },
    });

    await this.invalidateCatalog();
    return sale;
  }

  async findActive() {
    const cached = await this.redis.get(catalogKey);
    const campaigns = (
      cached ? (JSON.parse(cached) as CachedCatalogSale[]) : await this.readAndCacheCatalog()
    ) as CachedCatalogSale[];
    const itemIds = campaigns.flatMap((sale) => sale.items.map((item) => item.id));
    const remaining = itemIds.length
      ? await this.redis.mget(itemIds.map((id: string) => this.remainingKey(id)))
      : [];
    const quantities = new Map(itemIds.map((id: string, index: number) => [id, remaining[index]]));

    return campaigns.map((sale) => ({
      ...sale,
      items: sale.items.map((item) => ({
        ...item,
        remaining: Math.max(
          0,
          quantities.get(item.id) === null
            ? item.stockLimit - item.soldCount
            : Number(quantities.get(item.id)),
        ),
      })),
    }));
  }

  async findReports() {
    const sales = await this.prisma.flashSale.findMany({
      include: { items: { include: this.itemInclude } },
      orderBy: { createdAt: 'desc' },
    });

    return sales.map((sale) => this.formatReport(sale));
  }

  async findReport(id: string) {
    const sale = await this.prisma.flashSale.findUnique({
      where: { id },
      include: { items: { include: this.itemInclude } },
    });
    if (!sale) {
      throw new NotFoundException('Flash sale campaign not found');
    }

    return this.formatReport(sale);
  }

  async reserve(itemId: string, userId: string, quantity: number) {
    const item = await this.getReservableItem(itemId);
    await this.ensureInventory(item);
    const reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + reservationSeconds * 1000);
    const result = (await this.redis.eval(
      reserveScript,
      5,
      this.remainingKey(itemId),
      this.expirationKey(itemId),
      this.quantityKey(itemId),
      this.userKey(itemId),
      this.userQuantityKey(itemId),
      Date.now(),
      reservationId,
      userId,
      quantity,
      expiresAt.getTime(),
      item.perUserLimit,
    )) as [number, number];

    if (Number(result[0]) === -1) {
      throw new ConflictException('Flash sale item is sold out');
    }
    if (Number(result[0]) === -2) {
      throw new ConflictException('Flash sale purchase limit reached');
    }

    try {
      const reservation = await this.prisma.flashSaleReservation.create({
        data: {
          id: reservationId,
          flashSaleItemId: itemId,
          userId,
          quantity,
          expiresAt,
        },
      });
      return {
        id: reservation.id,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        remaining: Number(result[1]),
        item: this.formatItem(item),
      };
    } catch (error) {
      await this.releaseRedisReservation(itemId, reservationId, true);
      throw error;
    }
  }

  async findReservation(id: string, userId: string) {
    const reservation = await this.prisma.flashSaleReservation.findFirst({
      where: { id, userId },
      include: { flashSaleItem: { include: this.itemInclude } },
    });
    if (!reservation) {
      throw new NotFoundException('Flash sale reservation not found');
    }
    if (
      reservation.status === FlashSaleReservationStatus.ACTIVE &&
      reservation.expiresAt <= new Date()
    ) {
      await this.prisma.flashSaleReservation.updateMany({
        where: { id, status: FlashSaleReservationStatus.ACTIVE },
        data: { status: FlashSaleReservationStatus.EXPIRED },
      });
      throw new BadRequestException('Flash sale reservation has expired');
    }

    return {
      id: reservation.id,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      item: this.formatItem(reservation.flashSaleItem),
    };
  }

  async consumeReservation(itemId: string, reservationId: string) {
    await this.releaseRedisReservation(itemId, reservationId, false);
  }

  async restorePurchasedStock(itemId: string, userId: string, quantity: number) {
    await this.redis
      .multi()
      .incrby(this.remainingKey(itemId), quantity)
      .hincrby(this.userQuantityKey(itemId), userId, -quantity)
      .exec();
  }

  private async validateSaleItem(dto: CreateFlashSaleItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { productVariations: { where: { isActive: true } } },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Flash sale product not found or unavailable');
    }
    const variation = dto.variationId
      ? product.productVariations.find((candidate) => candidate.id === dto.variationId)
      : null;
    if (product.productVariations.length > 0 && !variation) {
      throw new BadRequestException('Select an active variation for a flash sale product');
    }
    if (dto.variationId && !variation) {
      throw new BadRequestException('Flash sale variation does not belong to the product');
    }
    const regularPrice = Number(variation?.price ?? product.price);
    const availableStock = variation?.stock ?? product.stock;
    if (dto.salePrice > regularPrice) {
      throw new BadRequestException('Flash sale price cannot exceed regular price');
    }
    if (dto.stockLimit > Math.min(product.stock, availableStock)) {
      throw new BadRequestException('Flash sale stock cannot exceed available product stock');
    }
  }

  private async readAndCacheCatalog() {
    const token = randomUUID();
    const lockKey = `${catalogKey}:lock`;
    const locked = await this.redis.set(lockKey, token, 'PX', 3000, 'NX');
    if (!locked) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const retry = await this.redis.get(catalogKey);
      if (retry) {
        return JSON.parse(retry);
      }
      const stale = await this.redis.get(staleCatalogKey);
      if (stale) {
        return JSON.parse(stale);
      }
      throw new ServiceUnavailableException('Flash sale catalog is warming up; retry shortly');
    }

    try {
      const now = new Date();
      const sales = await this.prisma.flashSale.findMany({
        where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
        include: { items: { include: this.itemInclude } },
        orderBy: { endsAt: 'asc' },
      });
      const response = sales.map((sale) => ({
        id: sale.id,
        name: sale.name,
        startsAt: sale.startsAt,
        endsAt: sale.endsAt,
        items: sale.items.map((item) => this.formatItem(item)),
      }));
      await this.redis
        .multi()
        .set(catalogKey, JSON.stringify(response), 'EX', 15 + Math.floor(Math.random() * 10))
        .set(staleCatalogKey, JSON.stringify(response), 'EX', 120)
        .exec();
      return response;
    } finally {
      await this.unlock(`${catalogKey}:lock`, token);
    }
  }

  private async getReservableItem(itemId: string): Promise<FlashSaleItemRecord> {
    const key = `flash-sales:item:${itemId}:record`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as FlashSaleItemRecord;
    }
    const now = new Date();
    const item = await this.prisma.flashSaleItem.findFirst({
      where: {
        id: itemId,
        flashSale: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
        product: { isActive: true },
      },
      include: this.itemInclude,
    });
    if (!item) {
      throw new NotFoundException('Active flash sale item not found');
    }
    const ttl = Math.max(1, Math.ceil((item.flashSale.endsAt.getTime() - Date.now()) / 1000));
    await this.redis.set(key, JSON.stringify(item), 'EX', ttl);
    return item;
  }

  private async ensureInventory(item: FlashSaleItemRecord) {
    const key = this.remainingKey(item.id);
    if ((await this.redis.exists(key)) === 1) {
      return;
    }
    const lockKey = `${key}:lock`;
    const token = randomUUID();
    if (!(await this.redis.set(lockKey, token, 'PX', 3000, 'NX'))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if ((await this.redis.exists(key)) === 1) {
        return;
      }
      throw new ServiceUnavailableException('Flash sale inventory is warming up; retry shortly');
    }
    try {
      const active = await this.prisma.flashSaleReservation.aggregate({
        where: {
          flashSaleItemId: item.id,
          status: FlashSaleReservationStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        _sum: { quantity: true },
      });
      const value = Math.max(0, item.stockLimit - item.soldCount - (active._sum.quantity ?? 0));
      const ttl = Math.max(
        reservationSeconds,
        Math.ceil((new Date(item.flashSale.endsAt).getTime() - Date.now()) / 1000) +
          reservationSeconds,
      );
      await this.redis.set(key, value, 'EX', ttl, 'NX');
    } finally {
      await this.unlock(lockKey, token);
    }
  }

  private formatItem(item: FlashSaleItemRecord) {
    return {
      id: item.id,
      salePrice: Number(item.salePrice),
      stockLimit: item.stockLimit,
      soldCount: item.soldCount,
      orderCount: item.orderCount,
      revenue: Number(item.revenue),
      perUserLimit: item.perUserLimit,
      product: {
        id: item.product.id,
        name: item.product.name,
        imageUrl:
          item.product.productImages.find((image) => image.isPrimary)?.imageUrl ??
          item.product.imageUrl,
        price: Number(item.product.price),
      },
      variation: item.variation
        ? {
            id: item.variation.id,
            price: Number(item.variation.price),
            options: item.variation.options.map((option) => ({
              id: option.variant.id,
              name: option.variant.name,
            })),
          }
        : null,
    };
  }

  private formatReport(sale: FlashSaleReportRecord) {
    const stockLimit = sale.items.reduce((sum, item) => sum + item.stockLimit, 0);
    const soldCount = sale.items.reduce((sum, item) => sum + item.soldCount, 0);
    const orderCount = sale.items.reduce((sum, item) => sum + item.orderCount, 0);
    const revenue = sale.items.reduce((sum, item) => sum + Number(item.revenue), 0);

    return {
      id: sale.id,
      name: sale.name,
      startsAt: sale.startsAt,
      endsAt: sale.endsAt,
      isActive: sale.isActive,
      metrics: {
        stockLimit,
        soldCount,
        orderCount,
        revenue: Math.round(revenue * 100) / 100,
        revenueBasis: 'COMPLETED_PAYMENT',
        sellThroughRate: stockLimit === 0 ? 0 : Math.round((soldCount / stockLimit) * 10000) / 100,
      },
      items: sale.items.map((item) => this.formatItem(item)),
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    };
  }

  private async invalidateCatalog() {
    await this.redis.del(catalogKey, staleCatalogKey);
  }

  private async unlock(key: string, token: string) {
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    );
  }

  private async releaseRedisReservation(
    itemId: string,
    reservationId: string,
    restoreStock: boolean,
  ) {
    await this.redis.eval(
      releaseScript,
      5,
      this.remainingKey(itemId),
      this.expirationKey(itemId),
      this.quantityKey(itemId),
      this.userKey(itemId),
      this.userQuantityKey(itemId),
      reservationId,
      restoreStock ? 1 : 0,
    );
  }

  private remainingKey(itemId: string) {
    return `flash-sales:item:${itemId}:remaining`;
  }
  private expirationKey(itemId: string) {
    return `flash-sales:item:${itemId}:expirations`;
  }
  private quantityKey(itemId: string) {
    return `flash-sales:item:${itemId}:quantities`;
  }
  private userKey(itemId: string) {
    return `flash-sales:item:${itemId}:users`;
  }
  private userQuantityKey(itemId: string) {
    return `flash-sales:item:${itemId}:user-quantities`;
  }

  private readonly itemInclude = {
    flashSale: true,
    product: { include: { productImages: true } },
    variation: { include: { options: { include: { variant: true } } } },
  } satisfies Prisma.FlashSaleItemInclude;
}

const reserveScript = `
local expired = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
for _, reservationId in ipairs(expired) do
  local quantity = tonumber(redis.call('HGET', KEYS[3], reservationId) or 0)
  local userId = redis.call('HGET', KEYS[4], reservationId)
  if quantity > 0 then
    redis.call('INCRBY', KEYS[1], quantity)
    if userId then redis.call('HINCRBY', KEYS[5], userId, -quantity) end
  end
  redis.call('HDEL', KEYS[3], reservationId)
  redis.call('HDEL', KEYS[4], reservationId)
  redis.call('ZREM', KEYS[2], reservationId)
end
local requested = tonumber(ARGV[4])
local used = tonumber(redis.call('HGET', KEYS[5], ARGV[3]) or 0)
if used + requested > tonumber(ARGV[6]) then return {-2, 0} end
local remaining = tonumber(redis.call('GET', KEYS[1]) or 0)
if remaining < requested then return {-1, remaining} end
remaining = redis.call('DECRBY', KEYS[1], requested)
redis.call('ZADD', KEYS[2], ARGV[5], ARGV[2])
redis.call('HSET', KEYS[3], ARGV[2], requested)
redis.call('HSET', KEYS[4], ARGV[2], ARGV[3])
redis.call('HINCRBY', KEYS[5], ARGV[3], requested)
return {1, remaining}
`;

const releaseScript = `
local quantity = tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or 0)
local userId = redis.call('HGET', KEYS[4], ARGV[1])
if quantity > 0 and tonumber(ARGV[2]) == 1 then
  redis.call('INCRBY', KEYS[1], quantity)
  if userId then redis.call('HINCRBY', KEYS[5], userId, -quantity) end
end
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('HDEL', KEYS[3], ARGV[1])
redis.call('HDEL', KEYS[4], ARGV[1])
return quantity
`;
