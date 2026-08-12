import { brand } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import type { SizeOption } from '@/lib/api/types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popularity', label: 'Popularity' },
];

/**
 * Ring/chain/bracelet size is a small ordered numeric range, not a handful
 * of named things to compare — `CheckmarkOption`'s stacked-checkbox layout
 * (right for Metal's ~6 options) turned 21 Indian ring sizes into a list
 * taller than the rest of the page. A wrapped grid of pill chips is the
 * standard treatment for this data shape (Tiffany, Blue Nile, etc.) and
 * matches the pill aesthetic already used for buttons/badges elsewhere.
 * Still a native `<input type="radio">` under the hood — only the visual
 * treatment changes, not the single-select semantics.
 */
function SizeChip({
  name,
  value,
  label,
  checked,
  srSuffix,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  /** Appended to the accessible name only — keeps "Any" compact on screen while announcing "Any size". */
  srSuffix?: string;
}) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span
        className="material-raised flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border border-border-warm px-2.5 text-xs font-medium text-ink-secondary transition-colors peer-checked:border-brand-ink peer-checked:bg-brand-primary peer-checked:text-white"
      >
        {label}
        {srSuffix && <span className="sr-only"> {srSuffix}</span>}
      </span>
    </label>
  );
}

function CheckmarkOption({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-3">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-[#C4A060] text-transparent peer-checked:border-brand-ink peer-checked:text-brand-ink"
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 10" className="h-2.5 w-2.5 fill-none stroke-current" strokeWidth={1.6}>
          <path d="M1 5l3.2 3.2L11 1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </label>
  );
}

/**
 * Plain GET form — filters work without JS (progressive enhancement).
 * Only surfaces filters the backend can actually apply (price range, metal —
 * matching the real MetalType enum) rather than decorative, non-functional rows.
 *
 * Size follows the same rule and adds one of its own: it renders only when the
 * category has a sizing scheme (FEAT-SIZE-TAXONOMY). An empty size selector on
 * a pair of earrings is worse than no selector, because it implies a choice
 * that does not exist.
 */
export function FilterForm({
  basePath,
  defaultMetal,
  defaultSort,
  defaultPriceMin,
  defaultPriceMax,
  sizeOptions = [],
  defaultSize,
}: {
  basePath: string;
  defaultMetal?: string;
  defaultSort?: string;
  defaultPriceMin?: string;
  defaultPriceMax?: string;
  /** Empty for categories with no sizing scheme — the section is then omitted. */
  sizeOptions?: SizeOption[];
  defaultSize?: string;
}) {
  const metalSection = brand.filterSections.find((s) => s.key === 'metal');

  return (
    <form method="get" action={basePath} className="divide-y divide-border" aria-label="Filter products">
      {/* Price */}
      <div className="pb-7">
        <p className="mb-4 text-sm font-semibold">Price</p>
        <div className="flex items-center gap-3">
          <label className="material-raised flex flex-1 items-center gap-1.5 rounded-full border border-border-warm bg-surface px-4 py-2">
            <span className="text-sm text-ink-muted" aria-hidden="true">
              {brand.currencySymbol}
            </span>
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              name="priceMin"
              min={0}
              placeholder="Min"
              defaultValue={defaultPriceMin}
              // The sidebar column is only 200-220px wide, and Chrome/Safari's
              // native up/down spin buttons were eating enough of that
              // already-tight pill that only "M" of "Min" stayed visible.
              // `appearance-none` on the input itself is the standard (Firefox)
              // way to drop them; the two ::-webkit-*-spin-button rules are
              // needed on top for Chrome/Safari, which ignore the bare property.
              className="w-full min-w-0 bg-transparent text-sm text-ink-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
          <span className="text-ink-muted" aria-hidden="true">
            –
          </span>
          <label className="material-raised flex flex-1 items-center gap-1.5 rounded-full border border-border-warm bg-surface px-4 py-2">
            <span className="text-sm text-ink-muted" aria-hidden="true">
              {brand.currencySymbol}
            </span>
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              name="priceMax"
              min={0}
              placeholder="Max"
              defaultValue={defaultPriceMax}
              className="w-full min-w-0 bg-transparent text-sm text-ink-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
        </div>
      </div>

      {/* Metal */}
      {metalSection && (
        <div className="py-7">
          <p className="mb-4 text-sm font-semibold">{metalSection.label}</p>
          <div className="flex flex-col gap-3.5 text-sm text-ink-secondary">
            {metalSection.options?.map((opt) => (
              <CheckmarkOption
                key={opt.value}
                name="metal"
                value={opt.value}
                label={opt.label}
                checked={defaultMetal === opt.value}
              />
            ))}
            <CheckmarkOption name="metal" value="" label="Any metal" checked={!defaultMetal} />
          </div>
        </div>
      )}

      {/* Size — only for categories that have a sizing scheme */}
      {sizeOptions.length > 0 && (
        <div className="py-7">
          <p className="mb-4 text-sm font-semibold" id="size-filter-label">
            Size
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="size-filter-label">
            <SizeChip name="size" value="" label="Any" srSuffix="size" checked={!defaultSize} />
            {sizeOptions.map((opt) => (
              <SizeChip
                key={opt.value}
                name="size"
                value={opt.value}
                label={opt.label}
                checked={defaultSize === opt.value}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="py-7">
        <label className="block text-sm font-semibold">
          Sort by
          <select
            name="sort"
            defaultValue={defaultSort ?? 'newest'}
            className="material-raised mt-3 block w-full rounded-full border border-border-warm bg-surface px-4 py-2 text-sm text-ink-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pt-7">
        <Button type="submit" variant="secondary" size="l" className="w-full">
          Apply filters
        </Button>
      </div>
    </form>
  );
}
