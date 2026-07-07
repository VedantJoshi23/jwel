'use client';

import { Minus, Plus } from 'lucide-react';

export function VisionQuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-5" role="group" aria-label="Quantity">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-10 w-10 items-center justify-center border border-[rgb(var(--v-ink)/0.2)] text-[rgb(var(--v-ink))] disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className="min-w-[1.5rem] text-center text-lg"
        style={{ fontFamily: 'var(--vision-font-serif)' }}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center border border-[rgb(var(--v-ink)/0.2)] text-[rgb(var(--v-ink))] disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
