import { brand } from '@/lib/brand';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popularity', label: 'Popularity' },
];

const sansFont = { fontFamily: 'var(--vision-font-sans)' } as const;

function VisionRadioOption({
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
    <label className="flex cursor-pointer items-center gap-3">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--v-ink)/0.3)] text-transparent peer-checked:border-[rgb(var(--v-gold))] peer-checked:text-[rgb(var(--v-gold))]"
        aria-hidden="true"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {label}
    </label>
  );
}

/**
 * Vision-styled twin of components/common/filter-form.tsx — identical plain-GET
 * progressive-enhancement behaviour and prop contract, only the markup is
 * re-tokenised to var(--v-*) so it lives in the light/dark theme system.
 */
export function VisionFilterForm({
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
    <form
      method="get"
      action={basePath}
      className="divide-y divide-[rgb(var(--v-ink)/0.1)] text-[rgb(var(--v-ink))]"
      aria-label="Filter products"
    >
      {/* Price */}
      <div className="pb-7">
        <p className="mb-4 text-[10px] uppercase text-[rgb(var(--v-gold))]" style={{ ...sansFont, letterSpacing: '.3em' }}>
          Price
        </p>
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-1.5 border border-[rgb(var(--v-ink)/0.2)] px-3 py-2">
            <span className="text-sm text-[rgb(var(--v-ink)/0.5)]" aria-hidden="true">
              {brand.currencySymbol}
            </span>
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              name="priceMin"
              min={0}
              placeholder="Min"
              defaultValue={defaultPriceMin}
              className="w-full bg-transparent text-sm text-[rgb(var(--v-ink))] outline-none placeholder:text-[rgb(var(--v-ink)/0.4)]"
            />
          </label>
          <span className="text-[rgb(var(--v-ink)/0.4)]" aria-hidden="true">
            –
          </span>
          <label className="flex flex-1 items-center gap-1.5 border border-[rgb(var(--v-ink)/0.2)] px-3 py-2">
            <span className="text-sm text-[rgb(var(--v-ink)/0.5)]" aria-hidden="true">
              {brand.currencySymbol}
            </span>
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              name="priceMax"
              min={0}
              placeholder="Max"
              defaultValue={defaultPriceMax}
              className="w-full bg-transparent text-sm text-[rgb(var(--v-ink))] outline-none placeholder:text-[rgb(var(--v-ink)/0.4)]"
            />
          </label>
        </div>
      </div>

      {/* Metal */}
      {metalSection && (
        <div className="py-7">
          <p className="mb-4 text-[10px] uppercase text-[rgb(var(--v-gold))]" style={{ ...sansFont, letterSpacing: '.3em' }}>
            {metalSection.label}
          </p>
          <div className="flex flex-col gap-3.5 text-sm text-[rgb(var(--v-ink)/0.7)]" style={sansFont}>
            {metalSection.options?.map((opt) => (
              <VisionRadioOption
                key={opt.value}
                name="metal"
                value={opt.value}
                label={opt.label}
                checked={defaultMetal === opt.value}
              />
            ))}
            <VisionRadioOption name="metal" value="" label="Any metal" checked={!defaultMetal} />
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="py-7">
        <label
          className="block text-[10px] uppercase text-[rgb(var(--v-gold))]"
          style={{ ...sansFont, letterSpacing: '.3em' }}
        >
          Sort by
          {/* Native <option>s render on the OS dropdown surface (usually white),
              so force dark option text for legibility in both themes. */}
          <select
            name="sort"
            defaultValue={defaultSort ?? 'newest'}
            className="mt-3 block w-full border border-[rgb(var(--v-ink)/0.2)] bg-transparent px-3 py-2 text-sm text-[rgb(var(--v-ink))]"
            style={sansFont}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-black">
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pt-7">
        <button
          type="submit"
          data-vision-magnet
          className="w-full bg-[rgb(var(--v-gold))] px-4 py-3 text-[11px] uppercase text-[rgb(var(--v-bg))] transition-transform hover:scale-[1.01]"
          style={{ ...sansFont, fontWeight: 500, letterSpacing: '.2em' }}
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
