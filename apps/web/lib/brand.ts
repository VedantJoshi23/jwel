/**
 * WHITE-LABEL CONFIG — edit this file only to rebrand the storefront.
 *
 * Every string, nav item, category, product type, and piece of copy that
 * appears in the UI is sourced from this object. To white-label:
 *   1. Change the values below (name, tagline, nav, categories, copy …)
 *   2. Update tailwind.config.ts color tokens (brand.primary, brand.accent, etc.)
 *   3. Swap the font variables in app/globals.css if desired
 *
 * Nothing else in the codebase needs to change for a full visual rebrand.
 */
export const brand = {
  // ── Identity ──────────────────────────────────────────────────────────────
  // RENAMED from "GLINT" (placeholder) to the client's real brand: ELYSIAN
  // (full wordmark "Elysian Ornaments"; tagline is the client's own, from
  // their logo mockup). Mechanical rename only — description/story/hero
  // copy below are still GLINT's old "festive Kundan/temple jhumka" framing
  // and are flagged pending, not silently rewritten, since the actual
  // positioning direction (palette, tone, narrative) is what's being
  // proposed to the client next, not decided yet.
  name: 'ELYSIAN',
  tagline: 'Elegance Redefined',
  // TODO — pending brand positioning discussion: this description still
  // describes the old GLINT festive/Kundan narrative, which doesn't match
  // either the ELYSIAN name or the real category taxonomy (adjustable/toe
  // rings, nazariya, kids' silver — broader everyday-wear range than a
  // purely festive/heirloom line implies).
  description:
    'Handcrafted Kundan chokers, temple jhumkas, pearl sets and meenakari rings — heirloom pieces built for festive glamour and everyday elegance.',

  // ── Brand story (About page + reused anywhere the same value props appear) ──
  // TODO — same pending-revision flag as `description` above; left intact
  // (not deleted) so nothing on the About page breaks before a real
  // ELYSIAN narrative is agreed with the client.
  story: {
    intro:
      "GLINT started with a simple idea: festive jewellery shouldn't mean choosing between heirloom craftsmanship and something you'd actually wear on a regular Tuesday. We work with artisan clusters who specialise in Kundan work, temple jhumkas, pearl sets and meenakari rings to bring that craftsmanship to pieces designed for everyday rotation, not just the back of a locker.",
    values: [
      {
        title: 'Handcrafted',
        body: 'Every piece is shaped, set and finished by hand by artisans who have spent decades perfecting Kundan, meenakari and temple jewellery techniques.',
      },
      {
        title: 'Heritage-led',
        body: 'Our designs draw on centuries-old South Asian jewellery traditions, reworked for how people actually dress and layer today.',
      },
      {
        title: 'Built to last',
        body: 'Tarnish-resistant plating and considered construction mean these are pieces you reach for season after season, not just for one occasion.',
      },
    ],
  },

  // ── SEO defaults (used in layout.tsx metadata) ─────────────────────────────
  seo: {
    defaultTitle: 'ELYSIAN — Elegance Redefined',
    titleTemplate: '%s | ELYSIAN',
    defaultDescription:
      'Handcrafted Kundan, temple jhumkas, pearl sets and meenakari rings — heirloom jewellery built for festive glamour and everyday elegance.',
    siteName: 'ELYSIAN',
  },

  // ── Localisation ──────────────────────────────────────────────────────────
  currency: 'INR',
  locale: 'en-IN',
  currencySymbol: '₹',

  // ── Announcement bar ──────────────────────────────────────────────────────
  announcement:
    'SALE LIVE ✦ Up to 60% OFF ✦ Extra ₹300 off at checkout ✦ Free shipping on orders above ₹999',

  // ── Navigation ────────────────────────────────────────────────────────────
  nav: [
    { label: 'Shop', href: '/collections/all' },
    { label: 'New Arrivals', href: '/collections/new-arrivals' },
    { label: 'About', href: '/about' },
  ],

  searchPlaceholder: 'Search jewellery…',

  // ── Homepage ──────────────────────────────────────────────────────────────
  hero: {
    headline: 'Timeless craft,\nfestive spirit.',
    subtext:
      'Handcrafted Kundan chokers, temple jhumkas, pearl sets and meenakari rings — heirloom pieces built for festive glamour and everyday elegance.',
    primaryCta: 'Shop the Collection',
    primaryCtaHref: '/collections/all',
    secondaryCta: 'Bestsellers',
    secondaryCtaHref: '/collections/bestsellers',
  },

  // Homepage category grid — updated to the client's real taxonomy
  // (previously invented placeholder slugs: jhumkas/necklace-sets/bangles
  // as if they were top-level categories; the client's data makes clear
  // those are actually sub-categories — see `subcategories` below).
  // Slugs match the exact slugification `/collections/[slug]/page.tsx`'s
  // filter-pill strip already derives from `productTypes` below
  // (`.toLowerCase().replace(/\s+/g,'-').replace(/&/g,'and')`) — kept in
  // sync by hand since that derivation isn't a shared helper today.
  homeCategories: [
    { slug: 'rings', name: 'Rings' },
    { slug: 'earrings', name: 'Earrings' },
    { slug: 'necklaces-and-pendants', name: 'Necklaces & Pendants' },
  ],

  newArrivals: {
    headline: 'New Arrivals',
    saleBadge: 'SALE LIVE',
    saleSubtext: 'Up to 66% OFF · Extra ₹300 off at checkout',
    subtext: 'Freshly crafted — ready to adorn',
  },

  subscription: {
    headline: 'Join Our Style Club',
    subtext:
      'Subscribe to our monthly Jewel Box and save 30%. A curated festive piece — kundan, meenakari or temple jewelry — delivered every month. Skip or cancel anytime.',
    steps: ['Pick your style', 'Choose frequency', 'Cancel anytime'],
    cta: 'Subscribe now',
    manageLink: 'Existing subscriber? Manage your Jewel Box here.',
  },

  bestsellers: {
    headline: 'Best Sellers',
    subtext:
      'The pieces our customers treasure most — handcrafted, tarnish-proof and made to last through every festive season.',
  },

  // ── Product / catalogue ───────────────────────────────────────────────────

  // Top-level product category pills shown on shop/collection pages —
  // the client's real main-category taxonomy (was a flat, partly-invented
  // list mixing top-level and sub-category names: Jhumkas/Necklace Sets/
  // Bangles/Choker Sets never actually existed as top-level categories).
  productTypes: ['Rings', 'Earrings', 'Necklaces & Pendants', 'Bracelets & Anklets'],

  // Sub-categories per main category, per the client-provided taxonomy.
  // Not yet wired into a filter UI (the collection page's `FilterForm` only
  // has a metal filter today) — `product.category` is a flat Category
  // record with a `parentId` the schema already supports, so this is the
  // data this codebase is missing, not a schema gap. Wiring a
  // sub-category pill/filter into `/collections/[slug]` is follow-up work,
  // not done as part of this taxonomy correction.
  subcategories: {
    Rings: ['Solitaire', 'Couple', 'Adjustable', 'Toe rings'],
    Earrings: ['Jhumkas', 'Hoops', 'Studs', 'Oxidised Silver'],
    'Necklaces & Pendants': ['Heart pendants', 'Zodiac pendants', 'Spiritual pendants'],
    'Bracelets & Anklets': ['Charm bracelets', 'Nazariya', "Kids' silver"],
  },

  // Sidebar filter sections on collection pages — values must match the
  // backend's MetalType enum exactly (see apps/api prisma schema).
  filterSections: [
    {
      key: 'metal',
      label: 'Metal',
      options: [
        { value: 'GOLD', label: 'Gold' },
        { value: 'GOLD_PLATED', label: 'Gold Plated' },
        { value: 'SILVER', label: 'Silver' },
        { value: 'PLATINUM', label: 'Platinum' },
        { value: 'STAINLESS_STEEL', label: 'Stainless Steel' },
      ],
    },
  ],

  // "You May Also Love" section on PDP
  pdp: {
    relatedHeadline: 'You May Also Love',
    addToBagLabel: 'Add to bag',
    quantityLabel: 'Quantity',
    shippingNote: 'Free standard delivery on all orders',
  },

  // ── Cart / Shopping Bag ────────────────────────────────────────────────────
  cart: {
    headline: 'My shopping bag',
    giftWrapLabel: 'Buying as a gift? Tick here to include premium gift wrapping & personal note.',
    newsletterOptInLabel: 'Subscribe to our newsletter for limited offers and promotions.',
    checkoutCta: 'Go to checkout',
    continueCta: 'Continue Shopping',
    emptyMessage: 'Your bag is empty.',
  },

  // ── Checkout ──────────────────────────────────────────────────────────────
  checkout: {
    itemsHeadline: 'Items overview',
    itemsSubtext: 'Review your order. All pieces are carefully gift-wrapped and dispatched within 24 hours.',
    paymentHeadline: 'Payment details',
    paymentSubtext: 'Fill in your payment details and complete the order.',
    shippingLabel: 'Available Shipping Methods',
    standardDeliveryLabel: 'Standard delivery',
    placeCta: 'Place Order',
  },

  // ── Contact ────────────────────────────────────────────────────────────────
  //
  // The client's real details, provided 2026-08-08. One source, because the
  // contact page and the footer previously disagreed with each other and with
  // reality: the page listed `care@glint.example` — a different brand's name —
  // and `+91 98765 43210`, the standard dummy Indian number, while the footer's
  // "WhatsApp us" pointed at `#`.
  //
  // `whatsappE164` is the number without punctuation, which is the only form
  // wa.me accepts; `whatsappDisplay` is what a human should read.
  contact: {
    email: 'helloelysianornaments@gmail.com',
    whatsappE164: '919335793085',
    whatsappDisplay: '+91 93357 93085',
    hours: 'Mon–Sat, 10am–7pm IST',
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    newsletterHeadline: "Let's stay in touch!",
    newsletterSubtext: 'Sign up to our newsletter and get the best deals.',
    newsletterPlaceholder: 'Insert your email address here',
    newsletterCta: 'Subscribe now',
    helpLinks: [
      { label: 'FAQ', href: '/faq' },
      { label: 'Customer service', href: '/customer-service' },
      { label: 'Shipping & returns', href: '/shipping' },
      { label: 'Contact us', href: '/contact' },
      // A real click-to-chat link. This is a *contact* channel, not a
      // notification one — sending automated WhatsApp messages needs
      // Business API credentials, which is a separate thing entirely
      // (FEAT-WHATSAPP-SMS-NOTIFICATIONS).
      { label: 'WhatsApp us', href: 'https://wa.me/919335793085' },
    ],
    otherLinks: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Sitemap', href: '/sitemap.xml' },
      { label: 'Subscriptions', href: '/subscriptions' },
    ],
  },
} as const;
