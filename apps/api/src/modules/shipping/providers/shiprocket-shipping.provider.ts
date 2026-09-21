import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch, ResilientFetchError } from '../../../common/http/resilient-fetch';
import { ServiceabilityCheckResult, ShippingProviderPort } from '../ports/shipping-provider.port';
import { StaticZoneShippingProvider } from './static-zone-shipping.provider';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

// Shiprocket's own token TTL is undocumented consistently across their own
// material (24h in some places, 240h/10 days in others) — refreshing a day
// early costs nothing and avoids ever serving a request with an expired
// token, so this is deliberately conservative rather than cutting it close.
const TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;
const TOKEN_ASSUMED_TTL_MS = 9 * 24 * 60 * 60 * 1000;

// Nominal parcel weight used ONLY for the serviceability lookup (courier
// availability/ETD for a route is bucketed by weight band, not exact
// grams) — NOT the real per-shipment weight `createShipment` will need once
// that's built. The client has not confirmed real packaging weight/
// dimensions yet; this is a deliberately visible placeholder, not a
// considered figure. Revisit before `createShipment` is implemented — a
// wrong weight there misdeclares the shipment to the carrier, not just the
// displayed estimate.
const PLACEHOLDER_PARCEL_WEIGHT_KG = 0.25;

interface ShiprocketLoginResponse {
  token?: string;
}

interface ShiprocketCourier {
  // Field names are best-effort from third-party integrations and Shiprocket
  // support material, NOT a verified copy of their current schema (their own
  // docs site is JS-rendered and this session could not read it) — hence
  // parsing several plausible field names defensively below rather than
  // trusting one. Confirm against a live response the first time this runs
  // against real credentials, and tighten this type once confirmed.
  estimated_delivery_days?: string | number;
  etd?: string;
  [key: string]: unknown;
}

interface ShiprocketServiceabilityResponse {
  data?: {
    available_courier_companies?: ShiprocketCourier[];
  };
}

/**
 * Real `ShippingProviderPort` adapter (`ADR-0001`), replacing
 * `StaticZoneShippingProvider` as the checkout-facing answer once the
 * client's Shiprocket account has usable API credentials.
 *
 * Scope of this increment: `checkServiceability` only. `createShipment` /
 * `cancelShipment` / webhook handling are NOT implemented here yet — they
 * need the `shipments` / `shipment_status_history` tables from
 * `FEAT-SHIPPING`'s still-pending Prisma migration first, so there is
 * nowhere to persist their result. Wiring those in without that migration
 * would be dead code with nothing to call it.
 *
 * Degrade behaviour (`FEAT-SHIPPING` Edge Case 1: a serviceability failure
 * must never block checkout) is implemented by falling back to
 * `StaticZoneShippingProvider` — reusing the exact `source: 'ESTIMATED'`
 * contract `ADR-0024` already built for "this is an estimate, not a
 * carrier-verified answer", rather than inventing a second one.
 */
@Injectable()
export class ShiprocketShippingProvider implements ShippingProviderPort {
  private readonly logger = new Logger(ShiprocketShippingProvider.name);
  private readonly email: string;
  private readonly password: string;
  private readonly pickupPincode: string;
  private tokenCache: { token: string; obtainedAt: number } | null = null;

  constructor(
    config: ConfigService,
    private readonly fallback: StaticZoneShippingProvider,
  ) {
    this.email = config.getOrThrow<string>('SHIPROCKET_EMAIL');
    this.password = config.getOrThrow<string>('SHIPROCKET_PASSWORD');
    this.pickupPincode = config.getOrThrow<string>('SHIPROCKET_PICKUP_PINCODE');
  }

  async checkServiceability(pincode: string): Promise<ServiceabilityCheckResult> {
    // A recorded business exception always wins, even over a live carrier
    // answer — same reasoning `StaticZoneShippingProvider`'s own docstring
    // gives, and it saves a network call for every pincode the business has
    // already made a call on.
    const override = await this.fallback.findOverride(pincode);
    if (override) return override;

    try {
      return await this.checkLive(pincode);
    } catch (error) {
      this.logger.warn(
        `Shiprocket serviceability check failed for pincode ${pincode}, degrading to the static ` +
          `estimate (FEAT-SHIPPING Edge Case 1): ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fallback.defaultEstimate(pincode);
    }
  }

  private async checkLive(pincode: string): Promise<ServiceabilityCheckResult> {
    const token = await this.getToken();

    const params = new URLSearchParams({
      pickup_postcode: this.pickupPincode,
      delivery_postcode: pincode,
      weight: String(PLACEHOLDER_PARCEL_WEIGHT_KG),
      // Prepaid-only store (KC-109, ADR-0029) — a constant, not a setting,
      // because COD is ruled out rather than merely switched off.
      cod: '0',
    });

    const response = await resilientFetch(`${BASE_URL}/courier/serviceability/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 4_000,
      retries: 1,
      idempotent: true,
    });

    if (!response.ok) {
      throw new Error(`Shiprocket serviceability call returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as ShiprocketServiceabilityResponse;
    const couriers = body.data?.available_courier_companies ?? [];

    if (couriers.length === 0) {
      return { pincode, deliverable: false, estimatedMinDays: null, estimatedMaxDays: null, source: 'CARRIER_VERIFIED' };
    }

    const days = couriers
      .map((courier) => this.parseEstimatedDays(courier))
      .filter((n): n is number => n !== null);

    if (days.length === 0) {
      // Shiprocket says the route is serviceable but returned no estimate we
      // could parse in any courier — still a real, carrier-confirmed
      // "deliverable", just with no window to show.
      return { pincode, deliverable: true, estimatedMinDays: null, estimatedMaxDays: null, source: 'CARRIER_VERIFIED' };
    }

    return {
      pincode,
      deliverable: true,
      estimatedMinDays: Math.min(...days),
      estimatedMaxDays: Math.max(...days),
      source: 'CARRIER_VERIFIED',
    };
  }

  /**
   * Tries every plausible shape a courier entry might carry its delivery
   * estimate in — see the field-uncertainty note on `ShiprocketCourier`
   * above. Returns `null` rather than throwing for a courier this can't
   * parse, so one odd entry doesn't take down the whole result.
   */
  private parseEstimatedDays(courier: ShiprocketCourier): number | null {
    const raw = courier.estimated_delivery_days;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      // Seen documented both as a plain number string ("3") and a range
      // ("3-4"); take the upper bound of a range for a single-number result.
      const match = raw.match(/(\d+)(?:\s*-\s*(\d+))?/);
      if (match) return Number(match[2] ?? match[1]);
    }

    if (typeof courier.etd === 'string') {
      const etdDate = new Date(courier.etd);
      if (!Number.isNaN(etdDate.getTime())) {
        const days = Math.ceil((etdDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return days > 0 ? days : 0;
      }
    }

    return null;
  }

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() - this.tokenCache.obtainedAt < TOKEN_ASSUMED_TTL_MS - TOKEN_REFRESH_MARGIN_MS) {
      return this.tokenCache.token;
    }

    let response;
    try {
      response = await resilientFetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
        timeoutMs: 5_000,
        retries: 0,
      });
    } catch (error) {
      throw new Error(
        `Shiprocket login request failed: ${error instanceof ResilientFetchError ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      throw new Error(`Shiprocket login returned HTTP ${response.status} — check SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD`);
    }

    const body = (await response.json()) as ShiprocketLoginResponse;
    if (!body.token) {
      throw new Error('Shiprocket login response had no token field');
    }

    this.tokenCache = { token: body.token, obtainedAt: Date.now() };
    return body.token;
  }
}
