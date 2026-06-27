import Link from 'next/link';
import { cn } from '@/lib/utils';

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

  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center gap-2">
      {Array.from({ length: totalPages }).map((_, i) => {
        const pageNumber = i + 1;
        const isCurrent = pageNumber === page;
        return (
          <Link
            key={pageNumber}
            href={hrefForPage(pageNumber)}
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-s border text-sm',
              isCurrent ? 'border-brand-primary bg-brand-primary text-white' : 'border-border',
            )}
          >
            {pageNumber}
          </Link>
        );
      })}
    </nav>
  );
}
