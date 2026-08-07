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
 * Range is 6–26, not the 1–37 published charts carry. Below 6 and above 26 is
 * outside normal adult retail, and seeding them would hand the client a
 * selector of mostly unstockable options. This is a seed decision, not a
 * physical constraint — extending the range is a row, not a migration
 * (FEAT-SIZE-TAXONOMY §6).
 *
 * For reference when writing the size guide: women's sizes cluster at 10–12
 * (11 most common), men's at 17–20.
 */
const RING_INDIA: SizeOptionSeed[] = [
  { value: '6', diameterMm: '14.68', circumferenceMm: '46.10', usEquivalent: '3', ukEquivalent: 'F' },
  { value: '7', diameterMm: '15.09', circumferenceMm: '47.40', usEquivalent: '3.5', ukEquivalent: 'G½' },
  { value: '8', diameterMm: '15.29', circumferenceMm: '48.00', usEquivalent: '4', ukEquivalent: 'H½' },
  { value: '9', diameterMm: '15.49', circumferenceMm: '48.70', usEquivalent: '4.5', ukEquivalent: 'I½' },
  { value: '10', diameterMm: '15.90', circumferenceMm: '50.00', usEquivalent: '5', ukEquivalent: 'J½' },
  { value: '11', diameterMm: '16.31', circumferenceMm: '51.20', usEquivalent: '5.5', ukEquivalent: 'L' },
  { value: '12', diameterMm: '16.51', circumferenceMm: '51.90', usEquivalent: '6', ukEquivalent: 'L½' },
  { value: '13', diameterMm: '16.92', circumferenceMm: '53.10', usEquivalent: '6.5', ukEquivalent: 'M½' },
  { value: '14', diameterMm: '17.32', circumferenceMm: '54.40', usEquivalent: '7', ukEquivalent: 'N½' },
  { value: '15', diameterMm: '17.53', circumferenceMm: '55.10', usEquivalent: '7.5', ukEquivalent: 'O½' },
  { value: '16', diameterMm: '17.93', circumferenceMm: '56.30', usEquivalent: '8', ukEquivalent: 'P½' },
  { value: '17', diameterMm: '18.14', circumferenceMm: '57.00', usEquivalent: '8.5', ukEquivalent: 'Q½' },
  { value: '18', diameterMm: '18.54', circumferenceMm: '58.30', usEquivalent: '9', ukEquivalent: 'R½' },
  { value: '19', diameterMm: '18.75', circumferenceMm: '58.90', usEquivalent: '9.5', ukEquivalent: 'S½' },
  { value: '20', diameterMm: '19.15', circumferenceMm: '60.20', usEquivalent: '10', ukEquivalent: 'T½' },
  { value: '21', diameterMm: '19.35', circumferenceMm: '60.80', usEquivalent: '10.5', ukEquivalent: 'U½' },
  { value: '22', diameterMm: '19.76', circumferenceMm: '62.10', usEquivalent: '11', ukEquivalent: 'V½' },
  { value: '23', diameterMm: '19.96', circumferenceMm: '62.70', usEquivalent: '11.5', ukEquivalent: 'W½' },
  { value: '24', diameterMm: '20.37', circumferenceMm: '64.00', usEquivalent: '12', ukEquivalent: 'Y' },
  { value: '25', diameterMm: '20.57', circumferenceMm: '64.60', usEquivalent: '12.5', ukEquivalent: 'Z' },
  { value: '26', diameterMm: '20.98', circumferenceMm: '65.90', usEquivalent: '13', ukEquivalent: 'Z+1' },
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
