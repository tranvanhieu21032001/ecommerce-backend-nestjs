import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
