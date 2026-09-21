import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { StaticZoneShippingProvider } from './providers/static-zone-shipping.provider';
import { ShiprocketShippingProvider } from './providers/shiprocket-shipping.provider';
import { SHIPPING_PROVIDER } from './ports/shipping-provider.port';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

// Decided once at module-init time from the real process environment, not a
// client-controllable flag — mirrors `payments.module.ts`'s own
// `isProduction` constant and the reasoning behind it.
const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [SettingsModule, AuditLogModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    StaticZoneShippingProvider,
    // Selected through a factory, not `useExisting`, so `ShiprocketShippingProvider`
    // is CONSTRUCTED only when credentials exist — its constructor calls
    // `getOrThrow` on them (mirrors `payments.module.ts`'s own reasoning for
    // the same pattern with `RazorpayPaymentProvider`).
    {
      provide: SHIPPING_PROVIDER,
      inject: [ConfigService, StaticZoneShippingProvider],
      useFactory: (config: ConfigService, staticProvider: StaticZoneShippingProvider) => {
        // Outside production, always the static estimator — local dev and CI
        // carry no real Shiprocket credentials, and shouldn't need any to run.
        if (!isProduction) return staticProvider;

        const hasCredentials =
          !!config.get<string>('SHIPROCKET_EMAIL') &&
          !!config.get<string>('SHIPROCKET_PASSWORD') &&
          !!config.get<string>('SHIPROCKET_PICKUP_PINCODE');

        // Unlike `PaymentsModule`, this does NOT refuse to boot: a missing
        // Shiprocket credential degrades to an estimate, it never risks
        // confirming money that didn't move (that asymmetry is the whole
        // reason `PaymentsModule` throws here and this doesn't). Still
        // logged at ERROR, not warn — a live shop quietly running on
        // estimates instead of carrier-verified delivery windows should be
        // impossible to miss in the logs.
        if (!hasCredentials) {
          new Logger('ShippingModule').error(
            'SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD / SHIPROCKET_PICKUP_PINCODE missing in ' +
              'production — falling back to the static estimator (ADR-0024). Set them to get ' +
              'live carrier-verified serviceability.',
          );
          return staticProvider;
        }

        return new ShiprocketShippingProvider(config, staticProvider);
      },
    },
  ],
})
export class ShippingModule {}
