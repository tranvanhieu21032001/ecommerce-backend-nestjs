import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, Variant } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { QueryVariantDto } from './dto/query-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { VariantResponseDto } from './dto/variant-response.dto';

type VariantWithProduct = Variant & {
  product: Pick<Product, 'id' | 'name' | 'sku'>;
};

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVariantDto: CreateVariantDto): Promise<VariantResponseDto> {
    await this.ensureProductExists(createVariantDto.productId);
    await this.ensureSkuAvailable(createVariantDto.sku);

    const variant = await this.prisma.variant.create({
      data: createVariantDto,
      include: this.variantInclude,
    });

    return this.formatVariant(variant);
  }

  async findAll(queryDto: QueryVariantDto): Promise<{
    data: VariantResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { productId, isActive, search, page = 1, limit = 10 } = queryDto;
    const where: Prisma.VariantWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.variant.count({ where });
    const variants = await this.prisma.variant.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: this.variantInclude,
    });

    return {
      data: variants.map((variant) => this.formatVariant(variant)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<VariantResponseDto> {
    const variant = await this.prisma.variant.findUnique({
      where: { id },
      include: this.variantInclude,
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.formatVariant(variant);
  }

  async findBySku(sku: string): Promise<VariantResponseDto> {
    const variant = await this.prisma.variant.findUnique({
      where: { sku },
      include: this.variantInclude,
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.formatVariant(variant);
  }

  async update(id: string, updateVariantDto: UpdateVariantDto): Promise<VariantResponseDto> {
    const existingVariant = await this.prisma.variant.findUnique({
      where: { id },
    });

    if (!existingVariant) {
      throw new NotFoundException('Variant not found');
    }

    if (updateVariantDto.productId && updateVariantDto.productId !== existingVariant.productId) {
      await this.ensureProductExists(updateVariantDto.productId);
    }

    if (updateVariantDto.sku && updateVariantDto.sku !== existingVariant.sku) {
      await this.ensureSkuAvailable(updateVariantDto.sku);
    }

    const variant = await this.prisma.variant.update({
      where: { id },
      data: updateVariantDto,
      include: this.variantInclude,
    });

    return this.formatVariant(variant);
  }

  async remove(id: string): Promise<{ message: string }> {
    const variant = await this.prisma.variant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.variant.delete({
      where: { id },
    });

    return { message: 'Variant deleted successfully' };
  }

  private readonly variantInclude = {
    product: {
      select: {
        id: true,
        name: true,
        sku: true,
      },
    },
  } satisfies Prisma.VariantInclude;

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async ensureSkuAvailable(sku: string): Promise<void> {
    const existingSku = await this.prisma.variant.findUnique({
      where: { sku },
    });

    if (existingSku) {
      throw new ConflictException(`Variant with sku ${sku} already exists`);
    }
  }

  private formatVariant(variant: VariantWithProduct): VariantResponseDto {
    return {
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: Number(variant.price),
      stock: variant.stock,
      imageUrl: variant.imageUrl,
      isActive: variant.isActive,
      product: {
        id: variant.product.id,
        name: variant.product.name,
        sku: variant.product.sku,
      },
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
