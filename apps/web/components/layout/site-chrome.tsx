import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { DemoModeBanner } from './demo-mode-banner';

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Above the header deliberately — a visitor must see this before they
          see anything that looks like a shop. Renders nothing when unset. */}
      <DemoModeBanner />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
