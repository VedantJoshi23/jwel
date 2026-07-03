'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from './header';
import { SiteFooter } from './footer';

// Routes listed here are fully isolated pitch/concept environments with their
// own nav, footer, fonts and color system — they must never inherit the real
// storefront's chrome (crimson announcement bar, GLINT header/footer).
const ISOLATED_ROUTES = ['/vision'];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isIsolated = ISOLATED_ROUTES.some((route) => pathname?.startsWith(route));

  if (isIsolated) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
