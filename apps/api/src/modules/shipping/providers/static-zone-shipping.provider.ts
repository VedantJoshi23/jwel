import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { ServiceabilityCheckResult, ShippingProviderPort } from '../ports/shipping-provider.port';

/**
 * The only `ShippingProviderPort` adapter until the client's suspended
 * Shiprocket account is restored (`ADR-0024`). No external call, no vendor —
 * a pan-India "deliverable unless flagged" default, layered under an
 * admin-maintained exceptions table for pincodes the business already knows
 * are unserviceable or warrant a different estimate window.
 *
 * An override always wins over the default when one exists for the pincode,
 * whether that override loosens or tightens the answer — this provider never
 * merges the two.
 */
@Injectable()
export class StaticZoneShippingProvider implements ShippingProviderPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async checkServiceability(pincode: string): Promise<ServiceabilityCheckResult> {
    const override = await this.prisma.pincodeServiceabilityOverride.findUnique({ where: { pincode } });

    if (override) {
      return {
        pincode,
        deliverable: override.deliverable,
        // The database's own `non_deliverable_has_no_window` CHECK constraint
        // already guarantees a non-deliverable row has no stored window — this
        // is belt-and-suspenders at the read path, not a correction of bad data.
        estimatedMinDays: override.deliverable ? override.estimatedMinDays : null,
        estimatedMaxDays: override.deliverable ? override.estimatedMaxDays : null,
        source: 'ESTIMATED',
      };
    }

    const [estimatedMinDays, estimatedMaxDays] = await Promise.all([
      this.settings.get('shipping.default_min_days'),
      this.settings.get('shipping.default_max_days'),
    ]);

    return { pincode, deliverable: true, estimatedMinDays, estimatedMaxDays, source: 'ESTIMATED' };
  }
}
