/**
 * Everything a caller gets back from a serviceability check, regardless of
 * which adapter answered it.
 *
 * `source` is the structural honesty mechanism `ADR-0024` requires: it is a
 * field the provider sets, not a copywriting choice a UI author could get
 * wrong or let drift. `StaticZoneShippingProvider` always returns
 * `'ESTIMATED'`; a future `ShiprocketProvider` behind this same port would
 * return `'CARRIER_VERIFIED'` for a real carrier-confirmed result. Callers
 * (the API response, then the UI) key their "Estimated" disclosure off this
 * field rather than assuming.
 */
export interface ServiceabilityCheckResult {
  pincode: string;
  deliverable: boolean;
  /** `null` when `deliverable` is false — there is nothing to estimate for a place this provider says it cannot reach. */
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  source: 'ESTIMATED' | 'CARRIER_VERIFIED';
}

/**
 * Port per `ADR-0001` (mirrors `PaymentProviderPort`) and `ADR-0024`
 * (the interim decision to build the first adapter as a non-Shiprocket
 * heuristic rather than wait). `ShippingService` only ever depends on this
 * interface — no adapter-specific shape may leak past it, so swapping
 * `StaticZoneShippingProvider` for a real `ShiprocketProvider` once the
 * client's Shiprocket account is restored is a contained adapter change, not
 * a rewrite of the controller, DTOs, or frontend.
 */
export interface ShippingProviderPort {
  checkServiceability(pincode: string): Promise<ServiceabilityCheckResult>;
}

export const SHIPPING_PROVIDER = 'SHIPPING_PROVIDER';
