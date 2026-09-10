'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState, describeError } from '@/components/common/error-state';

/**
 * Orders is the admin screen the business cannot work without, and the one
 * where a stale view is actively dangerous — an operator who cannot see an
 * order may conclude it does not exist and refund or re-ship against that.
 * The copy therefore says explicitly that nothing has been lost, only that
 * this view failed to load.
 */
export default function AdminOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { description } = describeError(error);

  return (
    <ErrorState
      title="Orders could not be loaded"
      description={`${description} No order data has been changed — this screen failed to load, nothing more.`}
      onRetry={reset}
      retryLabel="Reload orders"
      digest={error.digest}
    >
      <Button asChild variant="secondary" size="l">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </ErrorState>
  );
}
