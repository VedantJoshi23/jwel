'use client';

import { Button } from '@/components/ui/button';

/**
 * The visual body of every error boundary in the app.
 *
 * Boundaries themselves must be thin — `error.tsx` files are client components
 * Next mounts when a render throws, and a boundary that throws while rendering
 * its own fallback takes down the next boundary up. Keeping the markup here and
 * the boundaries as three-line wrappers means there is one place to get right.
 *
 * The copy distinguishes two cases deliberately. "We could not reach the shop"
 * and "something went wrong" call for different actions from the reader — one
 * is worth retrying immediately, the other usually is not — and telling a
 * customer to check their connection when the fault is ours is its own small
 * dishonesty.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  digest,
  children,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  digest?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-ink-secondary">{description}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button size="l" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {children}
      </div>

      {/*
        Next generates a digest for server-side errors and deliberately
        withholds the message from the client in production. Without the
        digest surfaced, a customer reporting a fault has nothing to quote and
        the matching server log cannot be found.
      */}
      {digest ? (
        <p className="mt-8 font-mono text-xs text-ink-muted">
          Reference: <span data-testid="error-digest">{digest}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A network failure and a server fault are told apart by what the API client
 * left behind. `ApiError` is only constructed once a response came back, so an
 * error that never became one — a `TypeError` from fetch, or an abort from the
 * client's own timeout — means we never reached the API.
 */
export function describeError(error: unknown): { title: string; description: string } {
  const name = error instanceof Error ? error.name : '';

  if (name === 'TimeoutError' || name === 'AbortError') {
    return {
      title: 'That took too long',
      description:
        'The shop did not respond in time. It may just be busy — trying again usually works.',
    };
  }

  if (name === 'TypeError') {
    return {
      title: 'We could not reach the shop',
      description:
        'This looks like a connection problem rather than a fault on our side. Check your internet and try again.',
    };
  }

  return {
    title: 'Something went wrong',
    description:
      'This one is on us. The problem has been logged — trying again may work, and if it does not, please get in touch.',
  };
}
