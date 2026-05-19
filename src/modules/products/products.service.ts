import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Brand, Category, Prisma, Product } from '@prisma/client';
import { ProductResponseDto } from './dto/product-response.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithCategoryAndTags = Product & {
  category: Category;
  brand: Brand | null;
  productTags?: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Create product
  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const tagIds = this.uniqueTagIds(createProductDto.tagIds);
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

    const product = await this.prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: new Prisma.Decimal(createProductDto.price),
          stock: createProductDto.stock,
          sku: createProductDto.sku,
          imageUrl: createProductDto.imageUrl,
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

      const productWithRelations = await tx.product.findUnique({
        where: { id: createdProduct.id },
        include: {
          category: true,
          brand: true,
          productTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!productWithRelations) {
        throw new NotFoundException('Product not found');
      }

      return productWithRelations;
    });

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
      include: {
        category: true,
        brand: true,
        productTags: {
          include: {
            tag: true,
          },
        },
      },
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
      include: {
        category: true,
        brand: true,
        productTags: {
          include: {
            tag: true,
          },
        },
      },
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

    if (
      updateProductDto.brandId !== undefined &&
      updateProductDto.brandId !== existingProduct.brandId
    ) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: updateProductDto.brandId },
      });
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    const tagIds = updateProductDto.tagIds ? this.uniqueTagIds(updateProductDto.tagIds) : undefined;
    if (tagIds) {
      await this.ensureTagsExist(tagIds);
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
    if (updateProductDto.imageUrl !== undefined) updateData.imageUrl = updateProductDto.imageUrl;
    if (updateProductDto.categoryId !== undefined)
      updateData.categoryId = updateProductDto.categoryId;
    if (updateProductDto.brandId !== undefined) updateData.brandId = updateProductDto.brandId;
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

      const productWithRelations = await tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          brand: true,
          productTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!productWithRelations) {
        throw new NotFoundException('Product not found');
      }

      return productWithRelations;
    });

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
        include: {
          category: true,
          brand: true,
          productTags: {
            include: {
              tag: true,
            },
          },
        },
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

    return { message: 'Product deleted successfully' };
  }

  private formatProduct(product: ProductWithCategoryAndTags): ProductResponseDto {
    return {
      ...product,
      price: Number(product.price),
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
    };
  }

  private uniqueTagIds(tagIds?: string[]): string[] {
    if (!tagIds?.length) {
      return [];
    }

    return [...new Set(tagIds.map((tagId) => tagId.trim()))].filter((tagId) => tagId.length > 0);
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
}
