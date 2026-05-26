import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Brand, Category, Prisma, Product } from '@prisma/client';
import Redis from 'ioredis';
import { ProductResponseDto } from './dto/product-response.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithCategoryAndTags = Product & {
  category: Category;
  brand: Brand | null;
  productImages?: Array<{
    id: string;
    imageUrl: string;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  productTags?: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  productVariations?: Array<{
    id: string;
    sku: string | null;
    price: Prisma.Decimal;
    stock: number;
    isActive: boolean;
    options: Array<{
      variant: {
        id: string;
        name: string;
        attributes: Prisma.JsonValue;
      };
    }>;
  }>;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly brandCachePattern = 'brands:*';

  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // Create product
  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const tagIds = this.uniqueTagIds(createProductDto.tagIds);
    const variations = createProductDto.variations ?? [];
    const variationVariantIds = this.uniqueVariationVariantIds(variations);
    const images = this.normalizeProductImages(createProductDto.images, createProductDto.imageUrl);
    const primaryImageUrl = images.find((image) => image.isPrimary)?.imageUrl ?? null;
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({
        where: { id: createProductDto.categoryId },
      }),
      createProductDto.brandId
        ? this.prisma.brand.findUnique({
            where: { id: createProductDto.brandId },
          })
        : Promise.resolve(null),
    ]);

    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (createProductDto.brandId && !brand) {
      throw new NotFoundException('Brand not found');
    }

    const existingSku = await this.prisma.product.findUnique({
      where: { sku: createProductDto.sku },
    });
    if (existingSku) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exist`);
    }

    if (tagIds.length > 0) {
      await this.ensureTagsExist(tagIds);
    }

    if (variationVariantIds.length > 0) {
      await this.ensureVariantsExist(variationVariantIds);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: new Prisma.Decimal(createProductDto.price),
          stock: createProductDto.stock,
          sku: createProductDto.sku,
          imageUrl: primaryImageUrl,
          categoryId: createProductDto.categoryId,
          brandId: createProductDto.brandId,
          isActive: createProductDto.isActive,
        },
      });

      if (tagIds.length > 0) {
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({
            productId: createdProduct.id,
            tagId,
          })),
        });
      }

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((image) => ({
            productId: createdProduct.id,
            imageUrl: image.imageUrl,
            sortOrder: image.sortOrder,
            isPrimary: image.isPrimary,
          })),
        });
      }

      for (const variation of variations) {
        const createdVariation = await tx.productVariation.create({
          data: {
            productId: createdProduct.id,
            sku: variation.sku,
            price: new Prisma.Decimal(variation.price),
            stock: variation.stock,
            isActive: variation.isActive,
          },
        });

        await tx.productVariationOption.createMany({
          data: this.uniqueIds(variation.variantIds).map((variantId) => ({
            productVariationId: createdVariation.id,
            variantId,
          })),
        });
      }

      const productWithRelations = await tx.product.findUnique({
        where: { id: createdProduct.id },
        include: this.productInclude,
      });

      if (!productWithRelations) {
        throw new NotFoundException('Product not found');
      }

      return productWithRelations;
    });

    if (createProductDto.brandId) {
      await this.clearBrandCache();
    }

    return this.formatProduct(product);
  }

  // Get all product
  async findAll(queryDto: QueryProductDto): Promise<{
    data: ProductResponseDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { categoryId, brandId, tagId, isActive, search, page = 1, limit = 10 } = queryDto;

    const where: Prisma.ProductWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (tagId) {
      where.productTags = {
        some: { tagId },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.product.count({ where });

    const products = await this.prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: this.productInclude,
    });

    return {
      data: products.map((product) => this.formatProduct(product)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get product by id
  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.formatProduct(product);
  }

  // Update product
  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });
    const brandId =
      updateProductDto.brandId !== undefined ? updateProductDto.brandId.trim() || null : undefined;

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const skuTaken = await this.prisma.product.findUnique({
        where: { sku: updateProductDto.sku },
      });

      if (skuTaken) {
        throw new ConflictException(`Product with SKU ${updateProductDto.sku} already exists`);
      }
    }

    if (
      updateProductDto.categoryId !== undefined &&
      updateProductDto.categoryId !== existingProduct.categoryId
    ) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    if (brandId !== undefined && brandId !== existingProduct.brandId) {
      if (brandId) {
        const brand = await this.prisma.brand.findUnique({
          where: { id: brandId },
        });
        if (!brand) {
          throw new NotFoundException('Brand not found');
        }
      }
    }

    const tagIds = updateProductDto.tagIds ? this.uniqueTagIds(updateProductDto.tagIds) : undefined;
    const variations = updateProductDto.variations;
    const images =
      updateProductDto.images !== undefined
        ? this.normalizeProductImages(updateProductDto.images, updateProductDto.imageUrl)
        : undefined;
    if (tagIds) {
      await this.ensureTagsExist(tagIds);
    }
    if (variations) {
      await this.ensureVariantsExist(this.uniqueVariationVariantIds(variations));
    }

    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    if (updateProductDto.name !== undefined) updateData.name = updateProductDto.name;
    if (updateProductDto.description !== undefined)
      updateData.description = updateProductDto.description;
    if (updateProductDto.price !== undefined) {
      updateData.price = new Prisma.Decimal(updateProductDto.price);
    }
    if (updateProductDto.stock !== undefined) updateData.stock = updateProductDto.stock;
    if (updateProductDto.sku !== undefined) updateData.sku = updateProductDto.sku;
    if (images !== undefined) {
      updateData.imageUrl = images.find((image) => image.isPrimary)?.imageUrl ?? null;
    } else if (updateProductDto.imageUrl !== undefined) {
      updateData.imageUrl = updateProductDto.imageUrl;
    }
    if (updateProductDto.categoryId !== undefined)
      updateData.categoryId = updateProductDto.categoryId;
    if (brandId !== undefined) updateData.brandId = brandId;
    if (updateProductDto.isActive !== undefined) updateData.isActive = updateProductDto.isActive;

    const updatedProduct = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: updateData,
      });

      if (tagIds !== undefined) {
        await tx.productTag.deleteMany({
          where: { productId: id },
        });

        if (tagIds.length > 0) {
          await tx.productTag.createMany({
            data: tagIds.map((tagId) => ({
              productId: id,
              tagId,
            })),
          });
        }
      }

      if (images !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((image) => ({
              productId: id,
              imageUrl: image.imageUrl,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            })),
          });
        }
      }

      if (variations !== undefined) {
        await tx.productVariation.deleteMany({
          where: { productId: id },
        });

        for (const variation of variations) {
          const createdVariation = await tx.productVariation.create({
            data: {
              productId: id,
              sku: variation.sku,
              price: new Prisma.Decimal(variation.price),
              stock: variation.stock,
              isActive: variation.isActive,
            },
          });

          await tx.productVariationOption.createMany({
            data: this.uniqueIds(variation.variantIds).map((variantId) => ({
              productVariationId: createdVariation.id,
              variantId,
            })),
          });
        }
      }

      const productWithRelations = await tx.product.findUnique({
        where: { id },
        include: this.productInclude,
      });

      if (!productWithRelations) {
        throw new NotFoundException('Product not found');
      }

      return productWithRelations;
    });

    if (brandId !== undefined && brandId !== existingProduct.brandId) {
      await this.clearBrandCache();
    }

    return this.formatProduct(updatedProduct);
  }

  // Update product stock
  async updateStock(id: string, quantity: number): Promise<ProductResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      if (quantity < 0) {
        const decrementBy = Math.abs(quantity);
        const updatedCount = await tx.product.updateMany({
          where: {
            id,
            stock: { gte: decrementBy },
          },
          data: {
            stock: {
              decrement: decrementBy,
            },
          },
        });

        if (updatedCount.count === 0) {
          const existedProduct = await tx.product.findUnique({
            where: { id },
            select: { id: true },
          });
          if (!existedProduct) {
            throw new NotFoundException('Product not found');
          }
          throw new BadRequestException('Insufficient stock');
        }
      } else if (quantity > 0) {
        const updatedCount = await tx.product.updateMany({
          where: { id },
          data: {
            stock: {
              increment: quantity,
            },
          },
        });

        if (updatedCount.count === 0) {
          throw new NotFoundException('Product not found');
        }
      } else {
        const existedProduct = await tx.product.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!existedProduct) {
          throw new NotFoundException('Product not found');
        }
      }

      const updatedProduct = await tx.product.findUnique({
        where: { id },
        include: this.productInclude,
      });

      if (!updatedProduct) {
        throw new NotFoundException('Product not found');
      }

      return this.formatProduct(updatedProduct);
    });
  }

  // Remove a product
  async remove(id: string): Promise<{ message: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
        cartItems: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.orderItems.length > 0) {
      throw new BadRequestException(
        'Cannot delete product that is part of existing orders. Consider marking it as inactive only',
      );
    }
    if (product.cartItems.length > 0) {
      throw new BadRequestException(
        'Cannot delete product that is currently in carts. Remove cart items first or mark product as inactive',
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });

    if (product.brandId) {
      await this.clearBrandCache();
    }

    return { message: 'Product deleted successfully' };
  }

  private formatProduct(product: ProductWithCategoryAndTags): ProductResponseDto {
    return {
      ...product,
      price: Number(product.price),
      images: product.productImages?.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      })),
      category: product.category.name,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
            slug: product.brand.slug,
            logoUrl: product.brand.logoUrl,
          }
        : null,
      tags: product.productTags?.map((productTag) => ({
        id: productTag.tag.id,
        name: productTag.tag.name,
        slug: productTag.tag.slug,
      })),
      variations: product.productVariations?.map((variation) => ({
        id: variation.id,
        sku: variation.sku,
        price: Number(variation.price),
        stock: variation.stock,
        isActive: variation.isActive,
        options: variation.options.map((option) => ({
          id: option.variant.id,
          name: option.variant.name,
          attributes: this.formatAttributes(option.variant.attributes),
        })),
      })),
    };
  }

  private readonly productInclude = {
    category: true,
    brand: true,
    productImages: {
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageUrl: true,
        sortOrder: true,
        isPrimary: true,
      },
    },
    productTags: {
      include: {
        tag: true,
      },
    },
    productVariations: {
      include: {
        options: {
          include: {
            variant: {
              select: {
                id: true,
                name: true,
                attributes: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.ProductInclude;

  private uniqueTagIds(tagIds?: string[]): string[] {
    return this.uniqueIds(tagIds);
  }

  private uniqueIds(ids?: string[]): string[] {
    if (!ids?.length) {
      return [];
    }

    return [...new Set(ids.map((id) => id.trim()))].filter((id) => id.length > 0);
  }

  private uniqueVariationVariantIds(
    variations: NonNullable<CreateProductDto['variations']>,
  ): string[] {
    return this.uniqueIds(variations.flatMap((variation) => variation.variantIds));
  }

  private normalizeProductImages(
    images?: CreateProductDto['images'],
    fallbackImageUrl?: string,
  ): Array<{ imageUrl: string; sortOrder: number; isPrimary: boolean }> {
    const normalized = (images ?? [])
      .map((image, index) => ({
        imageUrl: image.imageUrl.trim(),
        sortOrder: image.sortOrder ?? index,
        isPrimary: Boolean(image.isPrimary),
      }))
      .filter((image) => image.imageUrl.length > 0);

    if (normalized.length === 0 && fallbackImageUrl?.trim()) {
      return [
        {
          imageUrl: fallbackImageUrl.trim(),
          sortOrder: 0,
          isPrimary: true,
        },
      ];
    }

    if (normalized.length === 0) {
      return [];
    }

    const primaryIndex = normalized.findIndex((image) => image.isPrimary);
    const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return normalized.map((image, index) => ({
      ...image,
      sortOrder: Math.max(0, image.sortOrder),
      isPrimary: index === resolvedPrimaryIndex,
    }));
  }

  private async ensureTagsExist(tagIds: string[]): Promise<void> {
    const foundTags = await this.prisma.tag.findMany({
      where: {
        id: {
          in: tagIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (foundTags.length !== tagIds.length) {
      throw new NotFoundException('One or more tags not found');
    }
  }

  private async ensureVariantsExist(variantIds: string[]): Promise<void> {
    const foundVariants = await this.prisma.variant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (foundVariants.length !== variantIds.length) {
      throw new NotFoundException('One or more variants not found');
    }
  }

  private formatAttributes(attributes: Prisma.JsonValue): Record<string, unknown> {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      return {};
    }

    return attributes;
  }

  private async clearBrandCache(): Promise<void> {
    try {
      const keys = await this.scanCacheKeys(this.brandCachePattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Failed to clear brand cache: ${this.getErrorMessage(error)}`);
    }
  }

  private async scanCacheKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
