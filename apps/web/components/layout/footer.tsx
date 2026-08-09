import Link from 'next/link';
import { brand } from '@/lib/brand';

/**
 * Footer links are mostly internal routes, but "WhatsApp us" is an external
 * `wa.me` URL. `next/link` would prefetch it and would not set `rel`, so
 * external hrefs get a plain anchor with `noopener noreferrer` and an explicit
 * "opens in a new tab" hint for screen readers.
 */
function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-footer-ink">
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} className="hover:text-footer-ink">
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-footer-bg text-footer-ink">
      <div className="grid gap-10 px-6 py-11 lg:grid-cols-3 lg:px-8">
        {/* Col 1 — brand + social */}
        <div>
          <p className="mb-2.5 font-bold">{brand.footer.newsletterHeadline}</p>
          <p className="mb-5 max-w-[220px] text-sm text-footer-accent">
            {brand.footer.newsletterSubtext}
          </p>
          <div className="w-fit border-[1.5px] border-footer-divider px-4 py-3 font-display text-sm font-bold tracking-logo">
            {brand.name}
          </div>
          {/* Social icon placeholders */}
          <div className="mt-4 flex gap-3">
            <span className="h-5 w-5 rounded-full bg-footer-divider" aria-hidden="true" />
            <span className="h-5 w-5 rounded-full bg-footer-divider" aria-hidden="true" />
          </div>
        </div>

        {/* Col 2 — newsletter */}
        <div>
          <p className="mb-3 text-sm text-footer-accent">{brand.footer.newsletterPlaceholder}</p>
          <div className="mb-5 border-b border-footer-divider" />
          <button
            type="button"
            className="border-[1.5px] border-footer-ink px-4 py-2.5 text-sm font-semibold text-footer-ink hover:bg-footer-ink/10"
          >
            {brand.footer.newsletterCta}
          </button>
        </div>

        {/* Col 3 — nav links */}
        <div className="flex gap-12">
          <nav aria-label="Help">
            <p className="mb-3 font-bold text-white">Help</p>
            <ul className="space-y-2 text-sm text-footer-muted">
              {brand.footer.helpLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Other">
            <p className="mb-3 font-bold text-white">Other</p>
            <ul className="space-y-2 text-sm text-footer-muted">
              {brand.footer.otherLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
