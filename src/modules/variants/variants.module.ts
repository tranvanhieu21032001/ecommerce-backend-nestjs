import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';

@Module({
  imports: [PrismaModule],
  controllers: [VariantsController],
  providers: [VariantsService],
})
export class VariantsModule {}
