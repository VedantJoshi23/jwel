import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Indian PINs are exactly 6 digits and never start with 0 — the same rule the
 * `pincode_serviceability_overrides.pincode_format` CHECK constraint enforces.
 *
 * One definition because there used to be three, and they disagreed: the
 * delivery check was strict, a saved address accepted any 4–10 characters,
 * and an order accepted any string at all. A pincode the storefront refused to
 * estimate delivery for could still be placed as a real order's address.
 */
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PINCODE_MESSAGE = 'pincode must be a 6-digit Indian PIN code with no leading zero';

/**
 * Trims before validating, so whitespace cannot satisfy `IsNotEmpty` and the
 * stored snapshot carries no stray padding. Relies on the global
 * ValidationPipe's `transform: true`.
 */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const IsPincode = () =>
  applyDecorators(Trim(), IsString(), Matches(PINCODE_PATTERN, { message: PINCODE_MESSAGE }));

/**
 * A required address line. The length ceiling is generous — it exists to
 * refuse a pathological payload into a JSON snapshot column, not to police
 * real addresses, which are nowhere near it.
 */
export const IsAddressText = (maxLength: number) =>
  applyDecorators(Trim(), IsString(), IsNotEmpty(), MaxLength(maxLength));
