'use client';

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { checkServiceability } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ServiceabilityResult } from '@/lib/api/types';
// Shared with checkout and the saved-address form, so the delivery check can
// never accept a pincode that an order would refuse (FEAT-DELIVERY-ESTIMATE §7.4).
import { PINCODE_MESSAGE, PINCODE_PATTERN } from '@/lib/validation/address';

/**
 * One component, used on both the home page and the product detail page
 * (FEAT-DELIVERY-ESTIMATE §3) — not two implementations of the same check.
 *
 * `ADR-0024`: the result is an estimate, not a live carrier lookup. The
 * "Estimated" disclosure below is keyed off `result.source`, not a hardcoded
 * assumption, so a future carrier-backed provider changes what renders here
 * without this component itself changing.
 *
 * `useId()` for the input's id/label pairing — the Lavender Rose redesign
 * added a second instance of this same component to the header, rendered on
 * every page alongside the PDP's own instance, and a hardcoded id produced
 * two `id="pincode-check-input"` elements on one page (invalid HTML, and it
 * broke the `<label htmlFor>` association for whichever instance lost the
 * id race).
 *
 * `floatingStatus` — same redesign, same header instance: the result/error
 * region normally reserves `min-h-[1.25rem]` of block space below the form
 * even while empty, which is fine stacked in a page section but threw off
 * vertical centering in the header's compact single-line row (the taller
 * empty box centered differently than the header's other icon-height
 * items). In the header this floats the status below the input instead —
 * same `SearchSuggestions` dropdown pattern already used elsewhere in that
 * header — so the row's height is driven by the input/button alone.
 *
 * Floating also means the result has to be *dismissable*, which the inline
 * variant does not need. As a dropdown it looks like a popover, so people
 * expect it to close like one — and because the header sits in the storefront
 * layout, which survives client-side navigation, an undismissable result
 * followed the visitor onto every page until a full reload. It now closes on
 * a tap or click outside, on Escape, on navigation, and from its own button.
 */
export function PincodeCheck({
  className,
  floatingStatus = false,
}: {
  className?: string;
  floatingStatus?: boolean;
}) {
  const inputId = useId();
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const hasStatus = Boolean(error || result);

  const dismiss = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (floatingStatus) dismiss();
  }, [pathname, floatingStatus, dismiss]);

  useEffect(() => {
    if (!floatingStatus || !hasStatus) return;

    // `pointerdown`, not `click`: it fires for touch as well as mouse, and
    // before any focus change, so tapping a link elsewhere closes the dropdown
    // rather than leaving it over the page being navigated to. Presses inside
    // the component — the input, Check, the dropdown itself — keep it open.
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) dismiss();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [floatingStatus, hasStatus, dismiss]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!PINCODE_PATTERN.test(pincode)) {
      setResult(null);
      setError(PINCODE_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await checkServiceability(pincode));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check that pincode — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} className={cn(floatingStatus && 'relative', className)}>
      <form onSubmit={handleSubmit} className="flex max-w-sm gap-2">
        <label htmlFor={inputId} className="sr-only">
          Pincode
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter pincode"
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, ''))}
          className="w-full border-b border-border-warm bg-transparent px-1 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted"
        />
        <Button type="submit" size="s" loading={loading} disabled={loading}>
          Check
        </Button>
      </form>

      {/* One live region for both outcomes — result and error are always
          mutually exclusive (each setter clears the other), so there is
          never a case needing two independent announcements. In the floating
          variant the close button sits beside the live region rather than
          inside it, so "Close" is not read out as part of the result. */}
      <div
        className={cn(
          floatingStatus
            ? // Same dropdown treatment as components/common/search-suggestions.tsx,
              // for the same reason: floats below the input instead of reserving
              // block space, so it doesn't affect this row's height.
              cn(
                'absolute left-0 right-0 top-full z-50 mt-1 flex items-start gap-2 rounded-sm border border-border bg-surface p-2 shadow-lg',
                !hasStatus && 'hidden',
              )
            : 'mt-2 min-h-[1.25rem]',
        )}
      >
        <div role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
          {error && <p className="text-feedback-error">{error}</p>}
          {result && (
            <p className={cn(result.deliverable ? 'text-feedback-success' : 'text-feedback-warning')}>
              {result.deliverable ? (
                <>
                  Delivers to {result.pincode}
                  {result.estimatedMinDays != null && result.estimatedMaxDays != null && (
                    <>
                      {' '}
                      — estimated in {result.estimatedMinDays}–{result.estimatedMaxDays} business days
                    </>
                  )}
                </>
              ) : (
                <>We can&apos;t confirm delivery to {result.pincode} yet — please contact us to check.</>
              )}
              {result.source === 'ESTIMATED' && <span className="ml-1 text-ink-muted">(Estimated)</span>}
            </p>
          )}
        </div>
        {floatingStatus && hasStatus && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close delivery estimate"
            className="-m-1 shrink-0 rounded-sm p-1 text-ink-muted hover:bg-surface-alt hover:text-ink-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
