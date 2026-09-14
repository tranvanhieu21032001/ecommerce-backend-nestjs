import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CouponResponseDto } from './dto/coupon-response.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { ValidateCouponResponseDto } from './dto/validate-coupon-response.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCouponDto: CreateCouponDto): Promise<CouponResponseDto> {
    const code = this.normalizeCode(createCouponDto.code);
    await this.ensureCodeAvailable(code);
    this.validateCouponRules(createCouponDto);

    const coupon = await this.prisma.coupon.create({
      data: {
        ...createCouponDto,
        code,
      },
    });

    return this.formatCoupon(coupon);
  }

  async findAll(queryDto: QueryCouponDto): Promise<{
    data: CouponResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { isActive, discountType, search, page = 1, limit = 10 } = queryDto;
    const where: Prisma.CouponWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (discountType) {
      where.discountType = discountType;
    }

    if (search) {
      where.OR = [
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.coupon.count({ where });
    const coupons = await this.prisma.coupon.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: coupons.map((coupon) => this.formatCoupon(coupon)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<CouponResponseDto> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.formatCoupon(coupon);
  }

  async findByCode(code: string): Promise<CouponResponseDto> {
    const coupon = await this.findCouponByCode(code);
    return this.formatCoupon(coupon);
  }

  async update(id: string, updateCouponDto: UpdateCouponDto): Promise<CouponResponseDto> {
    const existingCoupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!existingCoupon) {
      throw new NotFoundException('Coupon not found');
    }

    const nextCode = updateCouponDto.code ? this.normalizeCode(updateCouponDto.code) : undefined;

    if (nextCode && nextCode !== existingCoupon.code) {
      await this.ensureCodeAvailable(nextCode);
    }

    this.validateCouponRules(
      {
        discountType: updateCouponDto.discountType ?? existingCoupon.discountType,
        discountValue: updateCouponDto.discountValue ?? Number(existingCoupon.discountValue),
        startsAt: updateCouponDto.startsAt ?? existingCoupon.startsAt ?? undefined,
        expiresAt: updateCouponDto.expiresAt ?? existingCoupon.expiresAt ?? undefined,
        usageLimit: updateCouponDto.usageLimit ?? existingCoupon.usageLimit ?? undefined,
      },
      existingCoupon.usedCount,
    );

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...updateCouponDto,
        ...(nextCode ? { code: nextCode } : {}),
      },
    });

    return this.formatCoupon(coupon);
  }

  async remove(id: string): Promise<{ message: string }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.coupon.delete({
      where: { id },
    });

    return { message: 'Coupon deleted successfully' };
  }

  async validate(validateCouponDto: ValidateCouponDto): Promise<ValidateCouponResponseDto> {
    const coupon = await this.findCouponByCode(validateCouponDto.code);
    this.ensureCouponCanApply(coupon, validateCouponDto.subtotal);

    const discountAmount = this.calculateDiscount(coupon, validateCouponDto.subtotal);

    return {
      valid: true,
      discountAmount,
      finalAmount: this.roundMoney(validateCouponDto.subtotal - discountAmount),
      coupon: this.formatCoupon(coupon),
    };
  }

  private async ensureCodeAvailable(code: string): Promise<void> {
    const existingCoupon = await this.prisma.coupon.findUnique({
      where: { code },
    });

    if (existingCoupon) {
      throw new ConflictException(`Coupon with code ${code} already exists`);
    }
  }

  private async findCouponByCode(code: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: this.normalizeCode(code) },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  private validateCouponRules(
    coupon: Pick<CreateCouponDto, 'discountType' | 'discountValue' | 'startsAt' | 'expiresAt'> & {
      usageLimit?: number;
    },
    usedCount = 0,
  ): void {
    if (coupon.discountType === DiscountType.PERCENTAGE && coupon.discountValue > 100) {
      throw new BadRequestException('Percentage discount value cannot exceed 100');
    }

    if (coupon.startsAt && coupon.expiresAt && coupon.startsAt >= coupon.expiresAt) {
      throw new BadRequestException('Coupon start date must be before expiration date');
    }

    if (coupon.usageLimit !== undefined && coupon.usageLimit < usedCount) {
      throw new BadRequestException('Usage limit cannot be lower than current used count');
    }
  }

  private ensureCouponCanApply(coupon: Coupon, subtotal: number): void {
    const now = new Date();

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }

    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon has not started yet');
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (subtotal < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Order subtotal must be at least ${Number(coupon.minOrderAmount)} to use this coupon`,
      );
    }
  }

  private calculateDiscount(coupon: Coupon, subtotal: number): number {
    const discount =
      coupon.discountType === DiscountType.PERCENTAGE
        ? subtotal * (Number(coupon.discountValue) / 100)
        : Number(coupon.discountValue);

    const cappedDiscount =
      coupon.maxDiscountAmount !== null
        ? Math.min(discount, Number(coupon.maxDiscountAmount))
        : discount;

    return this.roundMoney(Math.min(cappedDiscount, subtotal));
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatCoupon(coupon: Coupon): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: Number(coupon.minOrderAmount),
      maxDiscountAmount:
        coupon.maxDiscountAmount !== null
          ? Number(coupon.maxDiscountAmount)
          : coupon.maxDiscountAmount,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  }
}
