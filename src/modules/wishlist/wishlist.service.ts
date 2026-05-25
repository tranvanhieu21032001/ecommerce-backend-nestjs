import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

const wishlistInclude = {
  product: {
    include: {
      category: true,
      brand: true,
      productImages: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  },
} satisfies Prisma.WishlistItemInclude;

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{ include: typeof wishlistInclude }>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: wishlistInclude,
    });

    return this.formatWishlist(items);
  }

  async addItem(userId: string, dto: AddWishlistItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isActive: true },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found or unavailable');
    }

    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: { userId, productId: product.id },
      update: {},
    });

    return this.findAll(userId);
  }

  async removeItem(userId: string, productId: string) {
    const deleted = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Wishlist item not found');
    }

    return this.findAll(userId);
  }

  async clear(userId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });

    return this.findAll(userId);
  }

  private formatWishlist(items: WishlistItemWithProduct[]) {
    return {
      items: items.map((item) => ({
        id: item.id,
        product: {
          ...item.product,
          price: Number(item.product.price),
          category: item.product.category.name,
          images: item.product.productImages.map((image) => ({
            id: image.id,
            imageUrl: image.imageUrl,
            sortOrder: image.sortOrder,
            isPrimary: image.isPrimary,
          })),
          brand: item.product.brand
            ? {
                id: item.product.brand.id,
                name: item.product.brand.name,
                slug: item.product.brand.slug,
                logoUrl: item.product.brand.logoUrl,
              }
            : null,
        },
      })),
      itemCount: items.length,
    };
  }
}
