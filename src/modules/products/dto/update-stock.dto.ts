import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({
    description: 'Stock adjustment (positive to add, negative to subtract)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  quantity: number;
}
