import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  // PrismaModule is @Global (see prisma.module.ts), so PrismaService needs no
  // explicit import here.
  controllers: [HealthController],
})
export class HealthModule {}
