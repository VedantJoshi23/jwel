'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState, describeError } from '@/components/common/error-state';

/**
 * Admin's boundary. Phrased for an operator rather than a customer: they can
 * act on a reference code and they need to know whether their unsaved work
 * survived, which "something went wrong" alone does not tell them.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { title, description } = describeError(error);

  return (
    <ErrorState
      title={title}
      description={`${description} Anything you had not saved on this screen will need to be re-entered.`}
      onRetry={reset}
      retryLabel="Reload this screen"
      digest={error.digest}
    >
      <Button asChild variant="secondary" size="l">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </ErrorState>
  );
}
