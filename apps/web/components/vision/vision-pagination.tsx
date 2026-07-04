import Link from 'next/link';

/**
 * Vision-styled twin of components/common/pagination.tsx — same page-link
 * construction, re-tokenised to the var(--v-*) theme system.
 */
export function VisionPagination({
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
    <nav aria-label="Pagination" className="mt-16 flex justify-center gap-2">
      {Array.from({ length: totalPages }).map((_, i) => {
        const pageNumber = i + 1;
        const isCurrent = pageNumber === page;
        return (
          <Link
            key={pageNumber}
            href={hrefForPage(pageNumber)}
            data-vision-magnet
            aria-current={isCurrent ? 'page' : undefined}
            className={`flex h-10 w-10 items-center justify-center border text-sm transition-colors ${
              isCurrent
                ? 'border-[rgb(var(--v-gold))] bg-[rgb(var(--v-gold))] text-[rgb(var(--v-bg))]'
                : 'border-[rgb(var(--v-ink)/0.2)] text-[rgb(var(--v-ink)/0.7)] hover:border-[rgb(var(--v-gold))]'
            }`}
            style={{ fontFamily: 'var(--vision-font-serif)' }}
          >
            {pageNumber}
          </Link>
        );
      })}
    </nav>
  );
}
