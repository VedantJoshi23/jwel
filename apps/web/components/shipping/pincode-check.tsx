'use client';

import { FormEvent, useState } from 'react';
import { checkServiceability } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ServiceabilityResult } from '@/lib/api/types';

// Mirrors the server's own pincode DTO validation — a malformed pincode is
// refused with a specific message before any request is sent, not treated as
// "not deliverable" (FEAT-DELIVERY-ESTIMATE §7.4).
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/**
 * One component, used on both the home page and the product detail page
 * (FEAT-DELIVERY-ESTIMATE §3) — not two implementations of the same check.
 *
 * `ADR-0024`: the result is an estimate, not a live carrier lookup. The
 * "Estimated" disclosure below is keyed off `result.source`, not a hardcoded
 * assumption, so a future carrier-backed provider changes what renders here
 * without this component itself changing.
 */
export function PincodeCheck({ className }: { className?: string }) {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!PINCODE_PATTERN.test(pincode)) {
      setResult(null);
      setError('Enter a valid 6-digit pincode.');
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
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex max-w-sm gap-2">
        <label htmlFor="pincode-check-input" className="sr-only">
          Pincode
        </label>
        <input
          id="pincode-check-input"
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
          never a case needing two independent announcements. */}
      <div role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm">
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
    </div>
  );
}
