import Link from 'next/link';
import { cn } from '@/lib/utils';

const ELLIPSIS = 'ellipsis' as const;
type PageToken = number | typeof ELLIPSIS;

// Always keep first, last, current, and one neighbour on each side visible;
// collapse everything else behind an ellipsis. Caps the strip at a handful
// of links regardless of how many pages exist, instead of rendering one
// link per page (which broke the layout entirely once a category passed a
// few dozen pages — see the M8 implementation audit).
const MAX_PAGES_BEFORE_COLLAPSING = 7;

function buildPageTokens(current: number, totalPages: number): PageToken[] {
  if (totalPages <= MAX_PAGES_BEFORE_COLLAPSING) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const siblingCount = 1;
  const firstPage = 1;
  const lastPage = totalPages;
  const rangeStart = Math.max(current - siblingCount, firstPage);
  const rangeEnd = Math.min(current + siblingCount, lastPage);

  const tokens: PageToken[] = [];
  tokens.push(firstPage);
  if (rangeStart > firstPage + 1) tokens.push(ELLIPSIS);
  for (let p = Math.max(rangeStart, firstPage + 1); p <= Math.min(rangeEnd, lastPage - 1); p++) {
    tokens.push(p);
  }
  if (rangeEnd < lastPage - 1) tokens.push(ELLIPSIS);
  if (lastPage > firstPage) tokens.push(lastPage);

  return tokens;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefForPage(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set('page', String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  const tokens = buildPageTokens(page, totalPages);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const arrowLinkClasses = (disabled: boolean) =>
    cn(
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-s border text-sm',
      disabled ? 'pointer-events-none border-border text-ink-secondary/40' : 'border-border hover:border-brand-primary',
    );

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2 overflow-x-auto px-2">
      <Link
        href={hrefForPage(prevPage)}
        aria-label="Previous page"
        aria-disabled={page === 1}
        className={arrowLinkClasses(page === 1)}
      >
        ‹
      </Link>

      {tokens.map((token, i) =>
        token === ELLIPSIS ? (
          <span key={`ellipsis-${i}`} className="flex h-10 w-10 shrink-0 items-center justify-center text-sm text-ink-secondary">
            …
          </span>
        ) : (
          <Link
            key={token}
            href={hrefForPage(token)}
            aria-current={token === page ? 'page' : undefined}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-s border text-sm',
              token === page ? 'border-brand-primary bg-brand-primary text-white' : 'border-border',
            )}
          >
            {token}
          </Link>
        ),
      )}

      <Link
        href={hrefForPage(nextPage)}
        aria-label="Next page"
        aria-disabled={page === totalPages}
        className={arrowLinkClasses(page === totalPages)}
      >
        ›
      </Link>
    </nav>
  );
}
