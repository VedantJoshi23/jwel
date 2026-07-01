import { brand } from '@/lib/brand';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popularity', label: 'Popularity' },
];

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
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-[#C4A060] text-transparent peer-checked:border-brand-primary peer-checked:text-brand-primary"
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
 */
export function FilterForm({
  basePath,
  defaultMetal,
  defaultSort,
  defaultPriceMin,
  defaultPriceMax,
}: {
  basePath: string;
  defaultMetal?: string;
  defaultSort?: string;
  defaultPriceMin?: string;
  defaultPriceMax?: string;
}) {
  const metalSection = brand.filterSections.find((s) => s.key === 'metal');

  return (
    <form method="get" action={basePath} className="divide-y divide-border" aria-label="Filter products">
      {/* Price */}
      <div className="pb-7">
        <p className="mb-4 text-sm font-semibold">Price</p>
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-1.5 rounded-s border border-border-warm bg-surface px-3 py-2">
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
              className="w-full bg-transparent text-sm text-ink-primary outline-none"
            />
          </label>
          <span className="text-ink-muted" aria-hidden="true">
            –
          </span>
          <label className="flex flex-1 items-center gap-1.5 rounded-s border border-border-warm bg-surface px-3 py-2">
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
              className="w-full bg-transparent text-sm text-ink-primary outline-none"
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

      {/* Sort */}
      <div className="py-7">
        <label className="block text-sm font-semibold">
          Sort by
          <select
            name="sort"
            defaultValue={defaultSort ?? 'newest'}
            className="mt-3 block w-full rounded-s border border-border-warm bg-surface px-3 py-2 text-sm text-ink-primary"
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
        <button
          type="submit"
          className="w-full border border-brand-primary px-4 py-3 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
