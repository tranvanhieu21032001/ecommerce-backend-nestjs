import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

type OpenCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

const cartInclude = {
  cartItems: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        include: {
          category: true,
          brand: true,
          productImages: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async findOpenCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, checkedOut: false },
      orderBy: { createdAt: 'desc' },
      include: cartInclude,
    });

    return this.formatCart(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const quantity = dto.quantity ?? 1;

    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, isActive: true },
        select: { id: true, stock: true },
      });

      if (!product) {
        throw new NotFoundException('Product not found or unavailable');
      }

      const cart = await this.getOrCreateOpenCart(tx, userId);
      const existingItem = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      });
      const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

      this.assertAvailableQuantity(nextQuantity, product.stock);

      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
        create: { cartId: cart.id, productId: product.id, quantity },
        update: { quantity: nextQuantity },
      });
    });

    return this.findOpenCart(userId);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.requireOpenCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
      include: { product: { select: { stock: true, isActive: true } } },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    if (!item.product.isActive) {
      throw new BadRequestException('Product is no longer available');
    }

    this.assertAvailableQuantity(dto.quantity, item.product.stock);
    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.findOpenCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.requireOpenCart(userId);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Cart item not found');
    }

    return this.findOpenCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, checkedOut: false },
      orderBy: { createdAt: 'desc' },
    });

    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return this.findOpenCart(userId);
  }

  private async requireOpenCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, checkedOut: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  private async getOrCreateOpenCart(tx: Prisma.TransactionClient, userId: string) {
    const cart = await tx.cart.findFirst({
      where: { userId, checkedOut: false },
      orderBy: { createdAt: 'desc' },
    });

    return cart ?? tx.cart.create({ data: { userId } });
  }

  private assertAvailableQuantity(quantity: number, stock: number) {
    if (stock < quantity) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }
  }

  private formatCart(cart: OpenCart | null) {
    const items =
      cart?.cartItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
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
      })) ?? [];

    return {
      id: cart?.id ?? null,
      items,
      itemCount: items.reduce((count, item) => count + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.product.price * item.quantity, 0),
    };
  }
}
