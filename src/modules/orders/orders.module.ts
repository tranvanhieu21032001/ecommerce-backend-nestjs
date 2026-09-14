import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { FlashSalesModule } from '../flash-sales/flash-sales.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, PaymentsModule, FlashSalesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
