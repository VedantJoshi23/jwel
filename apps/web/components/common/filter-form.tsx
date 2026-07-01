import { brand } from '@/lib/brand';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popularity', label: 'Popularity' },
];

/**
 * Plain GET form — filters work without JS (progressive enhancement).
 * Visual style matches the GLINT wireframe sidebar: bordered collapsible
 * sections with checkbox options expanded for "Metal used".
 */
export function FilterForm({
  basePath,
  defaultMetal,
  defaultSort,
}: {
  basePath: string;
  defaultMetal?: string;
  defaultSort?: string;
}) {
  // Find the metal options section from brand config
  const metalSection = brand.filterSections.find((s) => s.key === 'metal');

  return (
    <form method="get" action={basePath} className="flex flex-col gap-2.5" aria-label="Filter products">
      {/* Collapsed filter rows (accordion-style, static for now) */}
      {brand.filterSections
        .filter((s) => s.key !== 'metal')
        .map((section) => (
          <div
            key={section.key}
            className="flex items-center justify-between rounded-s border border-border-warm px-3.5 py-3 text-sm text-ink-primary"
          >
            <span>{section.label}</span>
            <span className="text-ink-muted">▾</span>
          </div>
        ))}

      {/* Metal used — expanded with checkboxes */}
      {metalSection && (
        <div className="rounded-s border border-border-warm p-3.5">
          <p className="mb-3 text-sm font-semibold">{metalSection.label}</p>
          <div className="flex flex-col gap-2.5 text-sm text-ink-secondary">
            {metalSection.options?.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="metal"
                  value={opt.value}
                  defaultChecked={defaultMetal === opt.value}
                  className="peer sr-only"
                />
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-[#C4A060] peer-checked:border-brand-primary peer-checked:bg-brand-primary"
                  aria-hidden="true"
                />
                {opt.label}
              </label>
            ))}
            <label className="flex items-center gap-2.5">
              <input
                type="radio"
                name="metal"
                value=""
                defaultChecked={!defaultMetal}
                className="peer sr-only"
              />
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-[#C4A060] peer-checked:border-brand-primary peer-checked:bg-brand-primary"
                aria-hidden="true"
              />
              Any
            </label>
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="rounded-s border border-border-warm px-3.5 py-3">
        <label className="block text-sm font-semibold">
          Sort by
          <select
            name="sort"
            defaultValue={defaultSort ?? 'newest'}
            className="mt-2 block w-full rounded-s border border-border-warm bg-surface px-2 py-2 text-sm text-ink-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="w-full border border-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5"
      >
        Apply filters
      </button>
    </form>
  );
}
