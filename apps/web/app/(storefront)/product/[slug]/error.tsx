'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState, describeError } from '@/components/common/error-state';

/**
 * Product detail is the single most-visited dynamic route, and it composes the
 * most independently-failing pieces — gallery, variants, reviews, Q&A,
 * recommendations. Its own boundary keeps one of those taking down the page
 * from also costing the customer the route back into the catalogue.
 */
export default function ProductError({
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
      description={`${description} The rest of the collection is still available.`}
      onRetry={reset}
      digest={error.digest}
    >
      <Button asChild variant="secondary" size="l">
        <Link href="/collections/all">Browse all pieces</Link>
      </Button>
    </ErrorState>
  );
}
