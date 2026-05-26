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
      variation: {
        include: {
          options: {
            include: { variant: true },
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
        include: {
          productVariations: { where: { isActive: true } },
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found or unavailable');
      }

      const variation = dto.variationId
        ? product.productVariations.find((item) => item.id === dto.variationId)
        : null;

      if (product.productVariations.length > 0 && !variation) {
        throw new BadRequestException('Select a product variation before adding to cart');
      }
      if (dto.variationId && !variation) {
        throw new BadRequestException('Selected product variation is unavailable');
      }

      const cart = await this.getOrCreateOpenCart(tx, userId);
      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: product.id,
          variationId: variation?.id ?? null,
        },
      });
      const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

      this.assertAvailableQuantity(nextQuantity, variation?.stock ?? product.stock);

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: nextQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            variationId: variation?.id,
            quantity,
          },
        });
      }
    });

    return this.findOpenCart(userId);
  }

  async updateItem(
    userId: string,
    productId: string,
    variationId: string | undefined,
    dto: UpdateCartItemDto,
  ) {
    const cart = await this.requireOpenCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, variationId: variationId ?? null },
      include: {
        product: { select: { stock: true, isActive: true } },
        variation: { select: { stock: true, isActive: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    if (!item.product.isActive) {
      throw new BadRequestException('Product is no longer available');
    }
    if (item.variation && !item.variation.isActive) {
      throw new BadRequestException('Selected product variation is no longer available');
    }

    this.assertAvailableQuantity(dto.quantity, item.variation?.stock ?? item.product.stock);
    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.findOpenCart(userId);
  }

  async removeItem(userId: string, productId: string, variationId?: string) {
    const cart = await this.requireOpenCart(userId);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId, variationId: variationId ?? null },
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
        variationId: item.variationId,
        variation: item.variation
          ? {
              id: item.variation.id,
              sku: item.variation.sku,
              price: Number(item.variation.price),
              stock: item.variation.stock,
              isActive: item.variation.isActive,
              options: item.variation.options.map((option) => ({
                id: option.variant.id,
                name: option.variant.name,
                attributes: option.variant.attributes,
              })),
            }
          : null,
        unitPrice: Number(item.variation?.price ?? item.product.price),
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
      subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    };
  }
}
