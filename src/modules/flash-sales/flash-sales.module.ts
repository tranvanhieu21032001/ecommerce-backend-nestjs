import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FlashSalesController } from './flash-sales.controller';
import { FlashSalesService } from './flash-sales.service';

@Module({
  imports: [PrismaModule],
  controllers: [FlashSalesController],
  providers: [FlashSalesService],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
