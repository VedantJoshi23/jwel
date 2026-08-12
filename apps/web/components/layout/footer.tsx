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
    // No `bg-footer-bg` alongside `material-panel-deep`: the utility layer
    // would silently outrank the component-layer glass background (same
    // fix as the header — see components/layout/header.tsx).
    <footer className="material-panel-deep text-footer-ink">
      {/* `lg:grid-cols-2` since the newsletter column below is commented out.
          Restore to `lg:grid-cols-3` when re-enabling it, or the two remaining
          columns stretch across a gap where it used to be. */}
      <div className="grid gap-10 px-6 py-11 lg:grid-cols-2 lg:px-8">
        {/* Col 1 — brand + social */}
        <div>
          {/*
            The newsletter headline and subtext come out with the form below —
            see the block in col 2. Leaving them was worse than leaving the
            whole thing: "Sign up to our newsletter and get the best deals"
            with nothing to sign up *with* invites an action that no longer has
            an affordance. Restore both together.

            <p className="mb-2.5 font-bold">{brand.footer.newsletterHeadline}</p>
            <p className="mb-5 max-w-[220px] text-sm text-footer-accent">
              {brand.footer.newsletterSubtext}
            </p>
          */}
          <div className="w-fit rounded-full border-[1.5px] border-footer-divider px-4 py-3 font-display text-sm font-bold tracking-logo">
            {brand.name}
          </div>
          {/* Social icon placeholders */}
          <div className="mt-4 flex gap-3">
            <span className="h-5 w-5 rounded-full bg-footer-divider" aria-hidden="true" />
            <span className="h-5 w-5 rounded-full bg-footer-divider" aria-hidden="true" />
          </div>
        </div>

        {/*
          ── Col 2 — newsletter: REMOVED FROM DISPLAY 2026-08-09 ──────────────
          Owner decision. Kept as commented markup rather than deleted, so
          re-enabling is a matter of uncommenting rather than rebuilding.

          WHY IT CAME OUT. It was never a working sign-up. The "field" was a
          `<p>` with a border-bottom drawn underneath to look like an input —
          you could not type in it — and the button had no handler. There is no
          newsletter behind it either: no list, no provider, no endpoint. A
          customer typing their address into it and pressing Subscribe was
          being misled twice over. Constitution Law 1: a surface may not assert
          a capability the system does not have.

          TO RE-ENABLE, in this order — the markup is the last step, not the
          first:
            1. Choose a mailing provider and hold its API key as a secret.
            2. Add a real endpoint that stores the address and handles the
               double opt-in that Indian and EU recipients expect.
            3. Rebuild this block as a real <form> with an <input
               type="email" required>, a <label>, a submit handler, and
               success and failure states. Not a <p> and a <div>.
            4. Uncomment below, restore `lg:grid-cols-3` above, and mark
               `newsletter-signup` resolved in
               lib/storefront-claims.ts — the test will then check the copy is
               genuinely present rather than merely intended.

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
        ─────────────────────────────────────────────────────────────────────
        */}

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
