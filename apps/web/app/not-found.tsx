import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';

// No custom not-found existed before — the App Router's own internal
// default was relied on implicitly. That's fine for `next dev` (which
// never statically exports it), but `next build` occasionally failed
// exporting Next's internal fallback ("<Html> should not be imported
// outside of pages/_document") on the CI runner specifically, never
// reproduced locally. Providing an explicit not-found page is standard
// practice regardless of that build issue — better UX than a bare
// framework default — and gives Next a route to export instead of its
// own internal implementation.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-ink-secondary">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Button asChild size="l" className="mt-8">
        <Link href="/collections/all">Continue shopping at {brand.name}</Link>
      </Button>
    </div>
  );
}
