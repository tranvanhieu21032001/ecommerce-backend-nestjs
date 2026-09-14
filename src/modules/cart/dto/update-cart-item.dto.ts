import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New cart item quantity', example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
