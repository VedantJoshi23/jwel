'use client';

import { useRef, useState } from 'react';
import type { SizeOption } from '@/lib/api/types';

/**
 * Ring/chain/bracelet size is a small ordered numeric range, not a handful
 * of named things to compare — a stacked-checkbox layout (right for Metal's
 * ~6 options) turned 21 Indian ring sizes into a list taller than the rest
 * of the page. A wrapped grid of pill chips is the standard treatment for
 * this data shape (Tiffany, Blue Nile, etc.) and matches the pill aesthetic
 * already used for buttons/badges elsewhere. Still a native
 * `<input type="radio">` under the hood — only the visual treatment
 * changes, not the single-select semantics.
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
      <span className="material-raised flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border border-border-warm px-2.5 text-xs font-medium text-ink-secondary transition-colors peer-checked:border-brand-ink peer-checked:bg-brand-primary peer-checked:text-white">
        {label}
        {srSuffix && <span className="sr-only"> {srSuffix}</span>}
      </span>
    </label>
  );
}

/**
 * A dropdown, not the always-open chip grid: `<details>` is the same
 * no-JS-required disclosure pattern the FAQ page and this form's own mobile
 * filter panel use, so opening/closing needs no client state of its own —
 * only auto-closing *on selection* is genuinely JS-only (there is no CSS way
 * to close a `<details>` from a `<input>` inside it), which is the one
 * reason this is a client component rather than staying inline in the
 * server-rendered `FilterForm`. Without JS the picker still fully works —
 * it just stays open after a pick instead of closing itself.
 */
export function SizeFilterDropdown({
  sizeOptions,
  defaultSize,
}: {
  sizeOptions: SizeOption[];
  defaultSize?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  // Tracks only the trigger's own label — the radios themselves stay
  // uncommitted native inputs (`defaultChecked`), so this does not turn the
  // form controlled. Without this, the trigger read from `defaultSize` (a
  // prop that only changes on the next page navigation), so picking a size
  // closed the panel but left the trigger still showing the old value —
  // correct after "Apply filters" reloads the page, misleading before it.
  const [selectedValue, setSelectedValue] = useState(defaultSize);
  const selected = sizeOptions.find((opt) => opt.value === selectedValue);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="material-raised flex h-11 w-full cursor-pointer list-none items-center justify-between rounded-full border border-border-warm bg-surface px-4 text-sm text-ink-primary marker:content-none">
        <span>{selected ? selected.label : 'Any size'}</span>
        <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div
        // Wider than the trigger on purpose: at the sidebar's own width
        // (`w-full`, ~180-220px) the grid only fit 3 chips per row. This is
        // an overlay (`absolute`, above everything at z-20) with nowhere it
        // needs to respect the sidebar's column — widening it to fit 4
        // columns comfortably, with room before it would reach the page
        // edge, costs nothing the sidebar's own width was protecting.
        //
        // max-h + overflow-y-auto is load-bearing, not decorative: this panel
        // is `absolute`, so it is removed from normal flow and does not grow
        // the page to fit it. Without a cap, a page whose in-flow content
        // (a short product grid) ended above the panel's natural height left
        // the last few sizes genuinely unreachable — there was no more page
        // left to scroll into. Capping the panel's own height and letting it
        // scroll internally is what a native <select>'s listbox does too.
        className="material-card absolute z-20 mt-2 max-h-72 w-72 overflow-y-auto rounded-m border border-border p-3"
        onChange={(event) => {
          setSelectedValue((event.target as HTMLInputElement).value);
          // Single-select: a pick fully determines the filter, so there is
          // nothing left to do inside the panel. `.open = false` is the
          // native way to close a <details> imperatively.
          if (detailsRef.current) detailsRef.current.open = false;
        }}
      >
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
    </details>
  );
}
