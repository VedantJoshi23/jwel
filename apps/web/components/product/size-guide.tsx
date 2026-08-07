import { safeGetSizes } from '@/lib/api/sizes';
import type { SizeScheme } from '@/lib/api/types';

/**
 * FEAT-SIZE-TAXONOMY — the size guide on a product detail page.
 *
 * A server component that renders nothing for categories with no sizing
 * scheme, so the PDP can mount it unconditionally. Collapsed by default: it is
 * reference material, not part of the buying flow, and expanding it is a
 * deliberate act.
 *
 * Uses `<details>` rather than a JS disclosure so it works without hydration —
 * the same progressive-enhancement posture as the filter form.
 */

const SCHEME_COPY: Record<SizeScheme, { title: string; help: string } | null> = {
  NONE: null,
  RING_INDIA: {
    title: 'Ring size guide',
    // Deliberately advises measuring over converting. Published Indian charts
    // agree on circumference but differ by ~0.2mm on diameter, so a converted
    // figure carries a precision this data does not have (Law 1).
    help: 'Indian ring sizes. Measure the inside circumference of a ring that already fits — it is more reliable than converting from another country’s size. Most women’s sizes fall between 10 and 12; most men’s between 17 and 20.',
  },
  BANGLE_INDIA: {
    title: 'Bangle size guide',
    help: 'Indian bangle sizes, measured as the inner diameter in inches. Measure across the widest part of your hand with the thumb tucked in.',
  },
  CHAIN_LENGTH_MM: {
    title: 'Chain length guide',
    help: 'Total chain length. Measure a chain you already wear, or a piece of string held at the length you want it to sit.',
  },
  BRACELET_LENGTH_MM: {
    title: 'Bracelet & anklet length guide',
    help: 'Total length. Measure your wrist or ankle and add roughly 1–2 cm for comfort.',
  },
};

export async function SizeGuide({ scheme }: { scheme: SizeScheme | null | undefined }) {
  if (!scheme) return null;
  const copy = SCHEME_COPY[scheme];
  if (!copy) return null;

  const all = await safeGetSizes(scheme);
  // A custom size recovered from legacy data has no measurement, and the guide
  // exists to give measurements. Listing it with blank cells would suggest the
  // data is missing rather than genuinely unknown (criterion 11). It still
  // appears in the filter and on the product itself.
  const options = all.filter((option) => option.circumferenceMm !== null);
  if (options.length === 0) return null;

  // Only render columns the scheme actually populates — chains have no US or
  // UK equivalent, and a column of dashes reads as missing data rather than as
  // "not applicable".
  const hasDiameter = options.some((o) => o.diameterMm !== null);
  const hasUs = options.some((o) => o.usEquivalent !== null);
  const hasUk = options.some((o) => o.ukEquivalent !== null);

  return (
    <details className="mt-6 rounded-s border border-border-warm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-primary">
        {copy.title}
      </summary>

      <div className="px-4 pb-4">
        <p className="mb-4 text-sm leading-relaxed text-ink-secondary">{copy.help}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.title}</caption>
            <thead>
              <tr className="border-b border-border-warm text-ink-secondary">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Size
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Circumference
                </th>
                {hasDiameter && (
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Diameter
                  </th>
                )}
                {hasUs && (
                  <th scope="col" className="py-2 pr-4 font-medium">
                    US
                  </th>
                )}
                {hasUk && (
                  <th scope="col" className="py-2 font-medium">
                    UK
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.value} className="border-b border-border-warm/50 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-medium text-ink-primary">
                    {option.label}
                  </th>
                  <td className="py-2 pr-4 text-ink-secondary">{option.circumferenceMm} mm</td>
                  {hasDiameter && (
                    <td className="py-2 pr-4 text-ink-secondary">
                      {option.diameterMm ? `${option.diameterMm} mm` : '—'}
                    </td>
                  )}
                  {hasUs && (
                    <td className="py-2 pr-4 text-ink-secondary">{option.usEquivalent ?? '—'}</td>
                  )}
                  {hasUk && <td className="py-2 text-ink-secondary">{option.ukEquivalent ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Measurements are a guide. If you are between two sizes, choose the larger one.
        </p>
      </div>
    </details>
  );
}
