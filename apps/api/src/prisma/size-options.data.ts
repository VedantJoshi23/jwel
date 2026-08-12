import { SizeScheme } from '@prisma/client';

/**
 * FEAT-SIZE-TAXONOMY — the seeded size vocabulary.
 *
 * Kept as data rather than inline in the seed script (STD-CODE r5-adjacent:
 * seed content belongs in the seed path, and this is the part worth reading
 * on its own). Imported by both `seed-size-options.ts` and its tests, so the
 * table and the assertions cannot drift apart.
 *
 * `circumferenceMm` is authoritative. Published Indian ring charts agree on
 * circumference but differ by ~0.2mm on diameter, because diameter is derived
 * from it and rounded differently per vendor — Sukkhi lists size 10 at
 * 15.90mm, Chaitra at 15.7mm. Diameter is stored for the size guide's benefit,
 * but nothing should compute from it. Sources: FEAT-SIZE-TAXONOMY §10.
 */
export interface SizeOptionSeed {
  scheme: SizeScheme;
  value: string;
  label: string;
  diameterMm: string | null;
  circumferenceMm: string;
  usEquivalent: string | null;
  ukEquivalent: string | null;
  sortOrder: number;
}

/**
 * Indian ring sizes, the numeric scale used across the Indian market.
 *
 * Range is 10–15, not the fuller 6–26 this was originally seeded with —
 * owner decision, confirmed with the client: this catalogue's actual ring
 * stock clusters at 10–12 (11 most common, per the size guide notes below),
 * and the wider range was mostly unstockable options cluttering the
 * selector. Narrowing this list is a data decision, not a physical
 * constraint — re-widening it later is rows, not a migration
 * (FEAT-SIZE-TAXONOMY §6). The removed sizes' measurements are not lost,
 * only no longer offered — see git history for the full 6–26 table if they
 * are needed again.
 *
 * For reference when writing the size guide: women's sizes cluster at 10–12
 * (11 most common).
 */
const RING_INDIA: SizeOptionSeed[] = [
  { value: '10', diameterMm: '15.90', circumferenceMm: '50.00', usEquivalent: '5', ukEquivalent: 'J½' },
  { value: '11', diameterMm: '16.31', circumferenceMm: '51.20', usEquivalent: '5.5', ukEquivalent: 'L' },
  { value: '12', diameterMm: '16.51', circumferenceMm: '51.90', usEquivalent: '6', ukEquivalent: 'L½' },
  { value: '13', diameterMm: '16.92', circumferenceMm: '53.10', usEquivalent: '6.5', ukEquivalent: 'M½' },
  { value: '14', diameterMm: '17.32', circumferenceMm: '54.40', usEquivalent: '7', ukEquivalent: 'N½' },
  { value: '15', diameterMm: '17.53', circumferenceMm: '55.10', usEquivalent: '7.5', ukEquivalent: 'O½' },
].map((row, i) => ({
  scheme: SizeScheme.RING_INDIA,
  label: row.value,
  sortOrder: i,
  ...row,
}));

/**
 * Chain lengths in millimetres. Stored as millimetres so one unit serves every
 * length scheme; `label` carries the centimetre form customers actually read.
 *
 * `circumferenceMm` equals the length here — for an open chain the "around"
 * measurement *is* its length. Keeping the column meaningful rather than
 * nullable means the size guide can render every scheme through one code path.
 */
const CHAIN_LENGTH_MM: SizeOptionSeed[] = [
  { value: '400', label: '40 cm (16")' },
  { value: '450', label: '45 cm (18")' },
  { value: '500', label: '50 cm (20")' },
  { value: '550', label: '55 cm (22")' },
  { value: '600', label: '60 cm (24")' },
].map((row, i) => ({
  scheme: SizeScheme.CHAIN_LENGTH_MM,
  diameterMm: null,
  circumferenceMm: `${row.value}.00`,
  usEquivalent: null,
  ukEquivalent: null,
  sortOrder: i,
  ...row,
}));

/** Bracelet and anklet lengths, same millimetre convention as chains. */
const BRACELET_LENGTH_MM: SizeOptionSeed[] = [
  { value: '160', label: '16 cm' },
  { value: '170', label: '17 cm' },
  { value: '180', label: '18 cm' },
  { value: '190', label: '19 cm' },
  { value: '200', label: '20 cm' },
  { value: '220', label: '22 cm' },
  { value: '240', label: '24 cm' },
].map((row, i) => ({
  scheme: SizeScheme.BRACELET_LENGTH_MM,
  diameterMm: null,
  circumferenceMm: `${row.value}.00`,
  usEquivalent: null,
  ukEquivalent: null,
  sortOrder: i,
  ...row,
}));

/**
 * Indian bangle sizes — the 2.2 / 2.4 / 2.6 scale, where the value is the
 * inner diameter in inches. Included because the client's taxonomy has a
 * Bracelets & Anklets category that may carry bangles; unused schemes cost one
 * unreferenced enum value and nothing else.
 */
const BANGLE_INDIA: SizeOptionSeed[] = [
  { value: '2.2', diameterMm: '55.88', circumferenceMm: '175.60' },
  { value: '2.4', diameterMm: '60.96', circumferenceMm: '191.50' },
  { value: '2.6', diameterMm: '66.04', circumferenceMm: '207.50' },
  { value: '2.8', diameterMm: '71.12', circumferenceMm: '223.40' },
].map((row, i) => ({
  scheme: SizeScheme.BANGLE_INDIA,
  label: `${row.value}"`,
  usEquivalent: null,
  ukEquivalent: null,
  sortOrder: i,
  ...row,
}));

export const SIZE_OPTION_SEED: SizeOptionSeed[] = [
  ...RING_INDIA,
  ...CHAIN_LENGTH_MM,
  ...BRACELET_LENGTH_MM,
  ...BANGLE_INDIA,
];
