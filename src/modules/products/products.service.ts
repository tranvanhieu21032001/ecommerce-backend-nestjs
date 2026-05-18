import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Category, Prisma, Product } from '@prisma/client';
import { ProductResponseDto } from './dto/product-response.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Create product
  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const existingSku = await this.prisma.product.findUnique({
      where: { sku: createProductDto.sku },
    });
    if (existingSku) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exist`);
    }

    const product = await this.prisma.product.create({
      data: {
        ...createProductDto,
        price: new Prisma.Decimal(createProductDto.price),
      },
      include: {
        category: true,
      },
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
    const { categoryId, isActive, search, page = 1, limit = 10 } = queryDto;

    const where: Prisma.ProductWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
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

    const updateData: Prisma.ProductUncheckedUpdateInput = { ...updateProductDto };
    if (updateProductDto.price !== undefined) {
      updateData.price = new Prisma.Decimal(updateProductDto.price);
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
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

  private formatProduct(product: Product & { category: Category }): ProductResponseDto {
    return {
      ...product,
      price: Number(product.price),
      category: product.category.name,
    };
  }
}
