import { ShipmentStatus } from '@prisma/client';

/**
 * Shiprocket tracking-webhook parsing — pure functions, no I/O.
 *
 * Deliberately NOT a method on `ShiprocketShippingProvider`: that provider is
 * only constructed when the serviceability credentials are complete
 * (`shipping.module.ts`), but the webhook must work whenever
 * `SHIPROCKET_WEBHOOK_SECRET` is set, independently of them.
 *
 * Shape verified against the sample payload downloaded from the client's
 * Shiprocket Webhooks page (2026-09-21) — see the spec's fixture.
 */

export interface CarrierUpdate {
  awbCode: string;
  /** The carrier's own status text, kept verbatim for the history note. */
  rawStatus: string;
  /** Carrier-reported time of this status — what ordering is decided on. */
  occurredAt: Date;
  courierName: string | null;
  estimatedDelivery: Date | null;
}

/** `null` = recognised but moves nothing (pre-pickup chatter). */
export type MappedStatus = ShipmentStatus | null;

interface ShiprocketScan {
  date?: unknown;
}

interface ShiprocketWebhookBody {
  awb?: unknown;
  current_status?: unknown;
  shipment_status?: unknown;
  current_timestamp?: unknown;
  etd?: unknown;
  courier_name?: unknown;
  scans?: unknown;
}

// Shiprocket's own sample fills free-text fields with instructions such as
// "enter courier_name" — never store those as if they were data.
const PLACEHOLDER_TEXT = /^enter\s/i;

/**
 * Carrier timestamps carry no zone and are IST. Parsing them as UTC would put
 * every event 5½ hours in the future, and ordering compares against real
 * clocks elsewhere.
 *
 * Two layouts are accepted: the sample's `YYYY-MM-DD HH:mm:ss`, and the
 * `DD MM YYYY HH:mm:ss` some Shiprocket payloads use for `current_timestamp`.
 */
export function parseIstTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();

  let parts: RegExpMatchArray | null = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  let y: string, mo: string, d: string, h: string, mi: string, s: string | undefined;
  if (parts) {
    [, y, mo, d, h, mi, s] = parts;
  } else {
    parts = text.match(/^(\d{2})[ -/](\d{2})[ -/](\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!parts) return null;
    [, d, mo, y, h, mi, s] = parts;
  }

  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The AWB, read from the raw body text rather than the parsed JSON.
 *
 * Shiprocket sends `awb` as a JSON *number* (the sample: `59629792084`).
 * `JSON.parse` silently rounds integers past 2^53 — 16+ digits — so a long
 * AWB would arrive corrupted and never match. Carriers issue 10–15 digits
 * today; reading the digits as text removes the dependency on that holding.
 */
export function extractAwb(rawBody: Buffer | undefined, parsed: ShiprocketWebhookBody): string | null {
  if (rawBody) {
    const match = rawBody.toString('utf8').match(/"awb"\s*:\s*"?([0-9A-Za-z-]+)"?/);
    if (match) return match[1];
  }
  const { awb } = parsed;
  if (typeof awb === 'string' && awb.trim()) return awb.trim();
  if (typeof awb === 'number' && Number.isSafeInteger(awb)) return String(awb);
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && !PLACEHOLDER_TEXT.test(trimmed) ? trimmed : null;
}

/**
 * Returns `null` for a payload with no usable AWB, status or time. The caller
 * acknowledges it anyway: a malformed delivery redelivered is still malformed,
 * and reconciliation recovers whatever it was meant to say.
 */
export function parseShiprocketWebhook(body: unknown, rawBody?: Buffer): CarrierUpdate | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as ShiprocketWebhookBody;

  const awbCode = extractAwb(rawBody, payload);
  const rawStatus = text(payload.current_status) ?? text(payload.shipment_status);
  if (!awbCode || !rawStatus) return null;

  // Fall back to the newest scan when the top-level time is unusable, rather
  // than to "now" — receipt time says nothing about the order events happened.
  let occurredAt = parseIstTimestamp(payload.current_timestamp);
  if (!occurredAt && Array.isArray(payload.scans)) {
    const scanTimes = (payload.scans as ShiprocketScan[])
      .map((scan) => parseIstTimestamp(scan?.date))
      .filter((date): date is Date => date !== null);
    if (scanTimes.length > 0) occurredAt = new Date(Math.max(...scanTimes.map((date) => date.getTime())));
  }
  if (!occurredAt) return null;

  return {
    awbCode,
    rawStatus,
    occurredAt,
    courierName: text(payload.courier_name),
    estimatedDelivery: parseIstTimestamp(payload.etd),
  };
}

const PRE_PICKUP = new Set([
  'awb assigned',
  'label generated',
  'manifest generated',
  'pickup scheduled',
  'pickup generated',
  'pickup queued',
  'pickup rescheduled',
  'out for pickup',
  'pickup exception',
  'pickup error',
  'cancellation requested',
]);

const IN_TRANSIT = new Set([
  'in transit',
  'reached at destination hub',
  'reached destination hub',
  'misrouted',
  'delayed',
]);

/**
 * Carrier status text → `ShipmentStatus`. Matched on normalised text, not on
 * Shiprocket's numeric status ids: the text is what the sample payload
 * demonstrably carries, and an unrecognised string fails visibly (the caller
 * logs it) instead of being silently misfiled under a guessed id.
 *
 * Returns `undefined` for text this does not recognise at all.
 */
export function mapShiprocketStatus(rawStatus: string): MappedStatus | undefined {
  const status = rawStatus.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Order matters: every RTO state before plain "delivered", and
  // "undelivered" before "delivered", or substring tests would misfile them.
  if (status.startsWith('rto')) {
    return status.includes('delivered') && !status.includes('undelivered')
      ? ShipmentStatus.RTO_DELIVERED
      : ShipmentStatus.RTO_INITIATED;
  }
  if (status === 'canceled' || status === 'cancelled') return ShipmentStatus.CANCELLED;
  if (status === 'undelivered' || status === 'ndr') return ShipmentStatus.NDR;
  if (status === 'delivered') return ShipmentStatus.DELIVERED;
  if (status === 'out for delivery') return ShipmentStatus.OUT_FOR_DELIVERY;
  if (status === 'picked up' || status === 'shipped') return ShipmentStatus.PICKED_UP;
  if (IN_TRANSIT.has(status)) return ShipmentStatus.IN_TRANSIT;
  if (PRE_PICKUP.has(status)) return null;
  return undefined;
}
