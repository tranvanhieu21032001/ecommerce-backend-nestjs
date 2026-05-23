import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { generateSlug } from 'src/common/utils/slug.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrandResponseDto } from './dto/brand-response.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

type BrandListResponse = {
  data: BrandResponseDto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);
  private readonly cachePrefix = 'brands';
  private readonly cacheTtlSeconds = 300;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

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

    await this.clearBrandCache();

    return this.formatBrand(brand, brand._count.products);
  }

  async findAll(queryDto: QueryBrandDto): Promise<BrandListResponse> {
    const { isActive, search, page = 1, limit = 10 } = queryDto;
    const cacheKey = this.buildListCacheKey({ isActive, search, page, limit });
    const cached = await this.getCache<BrandListResponse>(cacheKey);

    if (cached) {
      return cached;
    }

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

    const result = {
      data: brands.map((brand) => this.formatBrand(brand, brand._count.products)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.setCache(cacheKey, result);

    return result;
  }

  async findOne(id: string): Promise<BrandResponseDto> {
    const cacheKey = `${this.cachePrefix}:id:${id}`;
    const cached = await this.getCache<BrandResponseDto>(cacheKey);

    if (cached) {
      return cached;
    }

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

    const result = this.formatBrand(brand, brand._count.products);
    await this.setCache(cacheKey, result);

    return result;
  }

  async findBySlug(slug: string): Promise<BrandResponseDto> {
    const cacheKey = `${this.cachePrefix}:slug:${slug}`;
    const cached = await this.getCache<BrandResponseDto>(cacheKey);

    if (cached) {
      return cached;
    }

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

    const result = this.formatBrand(brand, brand._count.products);
    await this.setCache(cacheKey, result);

    return result;
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

    await this.clearBrandCache();

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

    await this.clearBrandCache();

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

  private buildListCacheKey(query: {
    isActive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }): string {
    return [
      this.cachePrefix,
      'list',
      `active:${query.isActive ?? 'all'}`,
      `search:${query.search?.trim().toLowerCase() ?? ''}`,
      `page:${query.page}`,
      `limit:${query.limit}`,
    ].join(':');
  }

  private async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Failed to read brand cache key ${key}: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  private async setCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.cacheTtlSeconds);
    } catch (error) {
      this.logger.warn(`Failed to write brand cache key ${key}: ${this.getErrorMessage(error)}`);
    }
  }

  async clearBrandCache(): Promise<void> {
    try {
      const keys = await this.scanBrandCacheKeys();

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Failed to clear brand cache: ${this.getErrorMessage(error)}`);
    }
  }

  private async scanBrandCacheKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.cachePrefix}:*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
