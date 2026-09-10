'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState, describeError } from '@/components/common/error-state';

/**
 * Catches anything thrown below the storefront layout. The layout itself
 * survives, so the header, footer and bag stay usable — a customer who hits a
 * broken product page can still navigate, rather than being dropped onto a
 * blank screen with the back button as their only option.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { title, description } = describeError(error);

  return (
    <ErrorState title={title} description={description} onRetry={reset} digest={error.digest}>
      <Button asChild variant="secondary" size="l">
        <Link href="/collections/all">Continue shopping</Link>
      </Button>
    </ErrorState>
  );
}
