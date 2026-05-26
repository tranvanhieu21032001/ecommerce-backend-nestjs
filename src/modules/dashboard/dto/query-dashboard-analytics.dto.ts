import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class QueryDashboardAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Reporting window in calendar days',
    enum: [7, 30, 90],
    default: 30,
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  @IsOptional()
  days = 30;
}
