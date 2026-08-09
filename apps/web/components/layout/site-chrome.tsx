import { SiteHeader } from './header';
import { SiteFooter } from './footer';
import { DemoModeBanner } from './demo-mode-banner';
import { ClaimGuestCart } from '@/components/cart/claim-guest-cart';

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Above the header deliberately — a visitor must see this before they
          see anything that looks like a shop. Renders nothing when unset. */}
      <DemoModeBanner />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {/*
          Handing a guest bag to the account that just signed in
          (DOM-SHOPPING Invariants 6 and 17). Here rather than on the cart
          page for two reasons: the claim must run even when the account bag
          is empty — that is the silent-adoption case — and someone signing in
          lands wherever they were going, which is usually not /cart.

          Renders nothing unless signing in found two non-empty bags, in which
          case it asks. It never decides.
        */}
        <ClaimGuestCart />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
