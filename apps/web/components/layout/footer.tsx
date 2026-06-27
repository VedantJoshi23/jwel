export function SiteFooter() {
  return (
    <footer className="grid gap-10 bg-footer-bg px-6 py-11 text-footer-ink lg:grid-cols-3 lg:px-8">
      <div>
        <p className="mb-2 font-bold">Let&rsquo;s stay in touch!</p>
        <p className="mb-5 max-w-[220px] text-sm text-footer-ink/70">
          Sign up to our newsletter and get the best deals.
        </p>
        <div className="w-fit border border-brand-accent/60 px-4 py-3 font-display text-sm font-bold tracking-[0.2em]">
          JWEL
        </div>
      </div>

      <nav aria-label="Help">
        <p className="mb-3 font-bold text-white">Help</p>
        <ul className="space-y-2 text-sm text-footer-ink/70">
          <li>FAQ</li>
          <li>Customer service</li>
          <li>Shipping &amp; returns</li>
          <li>Contact us</li>
        </ul>
      </nav>

      <nav aria-label="Other">
        <p className="mb-3 font-bold text-white">Other</p>
        <ul className="space-y-2 text-sm text-footer-ink/70">
          <li>Privacy Policy</li>
          <li>Sitemap</li>
          <li>Subscriptions</li>
        </ul>
      </nav>
    </footer>
  );
}
