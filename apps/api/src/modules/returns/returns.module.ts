import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [InventoryModule, PaymentsModule, AuditLogModule, SettingsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
