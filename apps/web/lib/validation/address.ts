import { z } from 'zod';

/**
 * Mirrors `apps/api/src/common/validation/address.ts`. The API is the
 * authority — it refuses a bad address whatever the client sends — so this
 * exists for the customer's sake: to say what is wrong next to the field,
 * before they press "Place order", instead of after (ADR-0025).
 *
 * Mirrored rather than shared because the API validates with class-validator.
 * `address.test.ts` pins both sides to the same accept/reject examples.
 */
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PINCODE_MESSAGE = 'Enter a valid 6-digit pincode.';

export const pincodeSchema = z.string().trim().regex(PINCODE_PATTERN, PINCODE_MESSAGE);

const requiredText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);

export const addressSchema = z.object({
  line1: requiredText('Enter your street address.', 200),
  line2: z.string().trim().max(200, 'Keep this under 200 characters.').optional(),
  city: requiredText('Enter your city.', 100),
  state: requiredText('Enter your state.', 100),
  pincode: pincodeSchema,
});

export type AddressFormValues = z.input<typeof addressSchema>;
export const emptyAddress: AddressFormValues = { line1: '', line2: '', city: '', state: '', pincode: '' };
