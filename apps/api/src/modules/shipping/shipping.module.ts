import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { StaticZoneShippingProvider } from './providers/static-zone-shipping.provider';
import { SHIPPING_PROVIDER } from './ports/shipping-provider.port';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [SettingsModule, AuditLogModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    StaticZoneShippingProvider,
    // `useExisting`, not a second instance behind the token — the only
    // adapter today is `StaticZoneShippingProvider`. When the client's
    // Shiprocket account is restored (`ADR-0024`), a `ShiprocketProvider`
    // replaces this binding; `ShippingService` never changes.
    { provide: SHIPPING_PROVIDER, useExisting: StaticZoneShippingProvider },
  ],
})
export class ShippingModule {}
