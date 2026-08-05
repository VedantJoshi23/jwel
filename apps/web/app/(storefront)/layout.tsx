import { SiteChrome } from '@/components/layout/site-chrome';

// The storefront's header/footer/demo-banner live here rather than in the root
// layout so that `(admin)` doesn't inherit them. A route group does not escape
// the root layout, so while SiteChrome sat there, every /admin page rendered
// the shop's category nav, cart icon, newsletter footer and demo banner around
// the admin sidebar — none of which an admin can act on.
//
// Deliberately not a `usePathname().startsWith('/admin')` branch inside
// SiteChrome: that forces the header and footer client-side for every shopper,
// and renders the storefront chrome for one frame on admin pages before
// hydration removes it — the same hydration-race class of bug already fixed in
// AdminGuard (PR #20).
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
