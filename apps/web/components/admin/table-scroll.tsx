import { cn } from '@/lib/utils';

/**
 * The horizontal-scroll container every admin table sits in.
 *
 * A region that scrolls must be reachable by keyboard (WCAG 2.1.1; axe's
 * `scrollable-region-focusable`), or a keyboard user can see a table's first
 * columns and never the rest. Rows with no focusable controls give the
 * browser nothing to tab into, so the container itself takes focus, is
 * announced as a labelled region, and shows a ring when it has focus.
 *
 * Found when the admin layout stopped overflowing phones: before that, the
 * page scrolled rather than the table, so these containers never actually
 * scrolled and axe never flagged them.
 */
export function TableScroll({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'overflow-x-auto rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
        className,
      )}
    >
      {children}
    </div>
  );
}
