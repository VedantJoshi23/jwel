import { z } from 'zod';

const RATING_MESSAGE = 'Choose a star rating.';

/**
 * Mirrors CreateReviewDto: rating 1–5, optional title up to 120, required body.
 *
 * The rating is coerced because it arrives as a string. react-hook-form reads
 * a radio group with `getRadioValue(...).value` and does not apply
 * `valueAsNumber` to radios, so a chosen "4" reaches the schema as "4". An
 * untouched group arrives as null or undefined, which coerces to NaN or 0 and
 * fails with the same plain message.
 */
export const reviewSchema = z.object({
  rating: z.coerce
    .number({ error: RATING_MESSAGE })
    .int(RATING_MESSAGE)
    .min(1, RATING_MESSAGE)
    .max(5, RATING_MESSAGE),
  title: z.string().trim().max(120, 'Keep the title under 120 characters.').optional(),
  body: z.string().trim().min(1, 'Write a few words about the piece.'),
});

export type ReviewFormInput = z.input<typeof reviewSchema>;
export type ReviewFormValues = z.output<typeof reviewSchema>;
