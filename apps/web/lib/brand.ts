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
  name: 'GLINT',
  tagline: 'Timeless craft, festive spirit.',
  description:
    'Handcrafted Kundan chokers, temple jhumkas, pearl sets and meenakari rings — heirloom pieces built for festive glamour and everyday elegance.',

  // ── SEO defaults (used in layout.tsx metadata) ─────────────────────────────
  seo: {
    defaultTitle: 'GLINT — Timeless craft, festive spirit.',
    titleTemplate: '%s | GLINT',
    defaultDescription:
      'Handcrafted Kundan, temple jhumkas, pearl sets and meenakari rings — heirloom jewellery built for festive glamour and everyday elegance.',
    siteName: 'GLINT',
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
    { label: 'Temple Jewelry', href: '/collections/temple-jewelry' },
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

  // Homepage category grid (3 tiles)
  homeCategories: [
    { slug: 'jhumkas', name: 'Jhumkas' },
    { slug: 'necklace-sets', name: 'Necklace Sets' },
    { slug: 'bangles', name: 'Bangles' },
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

  // Top-level product category pills shown on shop/collection pages
  productTypes: ['Jhumkas', 'Necklace Sets', 'Rings', 'Bangles', 'Choker Sets'],

  // Sidebar filter sections on collection pages
  filterSections: [
    { key: 'customer', label: 'Targeted customer' },
    { key: 'price', label: 'Price' },
    { key: 'composition', label: 'Composition ratio' },
    {
      key: 'metal',
      label: 'Metal used',
      options: [
        { value: 'ANTIQUE_GOLD', label: 'Antique Gold' },
        { value: 'KUNDAN', label: 'Kundan Work' },
        { value: 'OXIDISED_SILVER', label: 'Oxidised Silver' },
      ],
    },
    { key: 'type', label: 'Type' },
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
      { label: 'WhatsApp us', href: '#' },
    ],
    otherLinks: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Sitemap', href: '/sitemap.xml' },
      { label: 'Subscriptions', href: '/subscriptions' },
      { label: 'Temple Jewelry', href: '/collections/temple-jewelry' },
    ],
  },
} as const;
