import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

// @Global — PaymentsService and AuthService each need MetricsService to
// record their own counters, and neither should have to import this module
// explicitly just to reach a shared Registry. Mirrors EventBusModule.
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
