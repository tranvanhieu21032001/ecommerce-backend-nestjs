import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryOrderDto {
  @ApiPropertyOptional({
    description: 'Filter orders by status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filter orders by customer ID for administrative listings',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Search orders by order number',
    example: 'cmay',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter orders created on or after this timestamp',
    example: '2026-05-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  createdFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter orders created on or before this timestamp',
    example: '2026-05-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  createdTo?: Date;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Number of orders per page',
    example: 10,
    default: 10,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit = 10;
}
