import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { generateSlug } from 'src/common/utils/slug.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrandResponseDto } from './dto/brand-response.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBrandDto: CreateBrandDto): Promise<BrandResponseDto> {
    const { name, slug, ...rest } = createBrandDto;
    const brandSlug = slug ?? generateSlug(name);

    const [existingName, existingSlug] = await Promise.all([
      this.prisma.brand.findUnique({ where: { name } }),
      this.prisma.brand.findUnique({ where: { slug: brandSlug } }),
    ]);

    if (existingName) {
      throw new ConflictException(`Brand with name ${name} already exists`);
    }

    if (existingSlug) {
      throw new ConflictException(`Brand with slug ${brandSlug} already exists`);
    }

    const brand = await this.prisma.brand.create({
      data: {
        name,
        slug: brandSlug,
        ...rest,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return this.formatBrand(brand, brand._count.products);
  }

  async findAll(queryDto: QueryBrandDto): Promise<{
    data: BrandResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { isActive, search, page = 1, limit = 10 } = queryDto;
    const where: Prisma.BrandWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.brand.count({ where });
    const brands = await this.prisma.brand.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return {
      data: brands.map((brand) => this.formatBrand(brand, brand._count.products)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return this.formatBrand(brand, brand._count.products);
  }

  async findBySlug(slug: string): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return this.formatBrand(brand, brand._count.products);
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<BrandResponseDto> {
    const existingBrand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!existingBrand) {
      throw new NotFoundException('Brand not found');
    }

    if (updateBrandDto.name && updateBrandDto.name !== existingBrand.name) {
      const nameTaken = await this.prisma.brand.findUnique({
        where: { name: updateBrandDto.name },
      });

      if (nameTaken) {
        throw new ConflictException(`Brand with name ${updateBrandDto.name} already exists`);
      }
    }

    if (updateBrandDto.slug && updateBrandDto.slug !== existingBrand.slug) {
      const slugTaken = await this.prisma.brand.findUnique({
        where: { slug: updateBrandDto.slug },
      });

      if (slugTaken) {
        throw new ConflictException(`Brand with slug ${updateBrandDto.slug} already exists`);
      }
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: updateBrandDto,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return this.formatBrand(brand, brand._count.products);
  }

  async remove(id: string): Promise<{ message: string }> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete brand with ${brand._count.products} products. Remove or reassign first`,
      );
    }

    await this.prisma.brand.delete({
      where: { id },
    });

    return { message: 'Brand deleted successfully' };
  }

  private formatBrand(brand: Brand, productCount: number): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      isActive: brand.isActive,
      productCount,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}
