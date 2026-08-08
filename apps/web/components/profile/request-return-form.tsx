'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { createReturn } from '@/lib/api/returns';
import type { OrderItem, ReturnReason } from '@/lib/api/types';

const REASONS: Array<{ value: ReturnReason; label: string }> = [
  { value: 'SIZE_ISSUE', label: 'It does not fit' },
  { value: 'DAMAGED', label: 'It arrived damaged' },
  { value: 'NOT_AS_DESCRIBED', label: 'It is not as described' },
  { value: 'CHANGED_MIND', label: 'I changed my mind' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * `DOM-RETURNS` §4 — the storefront may expose **request and status only.**
 *
 * There is no cancel control here, and none may be added: Invariant 6 says a
 * customer may not cancel a pending request nor re-request after a rejection,
 * and exceptions are handled out of band. The domain spec calls a cancel button
 * "the natural thing for a frontend developer to add", which is exactly why
 * this comment and the test guarding it both exist.
 */
export function RequestReturnForm({
  token,
  item,
  onRequested,
}: {
  token: string;
  item: OrderItem;
  onRequested: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason>('SIZE_ISSUE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createReturn(token, { orderItemId: item.id, reason, notes: notes.trim() || undefined });
      setOpen(false);
      onRequested();
    } catch (err) {
      // The API's own message, not a generic one. It is the only place that
      // knows *why* — most often that the return window has closed, and it
      // names the date it closed on.
      setError(err instanceof ApiError ? err.message : 'We could not start that return.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="s" onClick={() => setOpen(true)}>
        Request a return
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 border border-border p-3">
      <div>
        <label className="text-sm font-medium" htmlFor={`reason-${item.id}`}>
          Why are you returning this?
        </label>
        <select
          id={`reason-${item.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value as ReturnReason)}
          className="mt-1 h-10 w-full rounded-s border border-border bg-surface px-3 text-sm"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor={`notes-${item.id}`}>
          Anything else we should know? (optional)
        </label>
        <Input
          id={`notes-${item.id}`}
          className="mt-1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-feedback-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="s" loading={submitting}>
          Request return
        </Button>
        {/*
          Closes this form. It does not cancel anything — no request exists
          yet, and once one does it cannot be withdrawn (Invariant 6).
        */}
        <Button type="button" variant="ghost" size="s" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </form>
  );
}
