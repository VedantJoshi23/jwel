# Jwel — Product Requirements Document (PRD)

**Milestone 1 — Product Discovery**
**Role:** Product Manager
**Status:** Discovery complete. No code written this milestone.

---

## 1. Product Overview

Jwel is a premium jewellery e-commerce platform for the Indian market, covering rings,
earrings, necklaces, bracelets, pendants, diamond collections, and gold collections.
The product must close the two structural gaps that legacy players still struggle
with: **trust** (authenticity, certification, returns) and **confidence** (fit, look,
gifting correctness) — while layering in AI-driven personalization that none of the
three benchmarked incumbents currently do well.

---

## 2. Competitor Analysis

Research basis: public website/app feature review of Tanishq, BlueStone, and
CaratLane (see Sources at bottom).

| Dimension | **Tanishq** | **BlueStone** | **CaratLane** |
|---|---|---|---|
| Parent / trust signal | Titan / Tata — strongest legacy brand trust in India | Independent, online-first since ~2011 | Tata-owned (since 2016) — inherits Tata trust |
| Core differentiator | Heritage, wedding/bridal gold collections, pan-India store network | Digital-first, certified jewellery, video-call consultation | Diamond/solitaire focus, deep customization, fast "Try at Home" |
| Fit/sizing tools | Ring Size Calculator (visual/QR-based), Virtual Try-On in app | Try-At-Home service (physical), video consultation with expert | Try-At-Home with nearest-store + fastest-delivery logic |
| Certification/hallmark | BIS hallmark standard (legacy jeweller credibility) | BIS Hallmark + SGL/IGI/GIA/HKD certification, explicitly marketed | BIS hallmark + diamond authenticity certificate per ring |
| Pricing transparency | Daily gold rate ticker (18k/22k/24k) in app | Less prominent real-time rate display | Per-product certificate, less emphasis on live rate ticker |
| Customization | Limited (mostly catalog-based) | Limited | Strong — engraving, couple-band customization, "Design Your Own" |
| Returns/guarantee | Standard return window | 30-day money-back guarantee, lifetime exchange policy | Exchange/buyback program (Tata-backed) |
| Delivery | Free shipping, COD, free 2-day delivery, contactless/UV-sanitized packaging | Free shipping, COD | Fastest-delivery-date estimator shown per SKU |
| Personalization / AI | None observed beyond basic catalog filters | None observed | None observed |
| Gifting flows | Generic gifting category pages | Generic gifting category pages | Generic gifting category pages |
| Try-on technology | App-based Virtual Try-On (AR-style) | None (physical try-at-home only) | None (physical try-at-home only) |

### Key Takeaways

1. **No competitor has a strong AI recommendation or gifting-intelligence layer.** This
   is Jwel's clearest whitespace — see Advanced Features.
2. **Virtual/AR try-on exists only at Tanishq**, and only in-app. A web-based "Jewelry
   Try-On Preparation" capability (per Jwel's required features) is a differentiator
   if Tanishq's is app-locked.
3. **Trust mechanics (hallmark, certification, money-back guarantees) are table
   stakes**, not differentiators — Jwel must match, not lead, here.
4. **Customization is CaratLane's edge**; Jwel should support engraving/personalization
   from MVP+1 to stay competitive in rings/pendants.
5. **Physical "Try at Home" requires logistics/ops infra (couriers carrying inventory,
   KYC, insurance)** that is out of scope for a pure software build — Jwel will
   substitute this with Virtual Try-On + accurate sizing tools + a generous,
   friction-free returns flow instead of building a physical trial fleet in MVP.

**Sources:**
- [Tanishq Ring Size Calculator](https://www.tanishq.co.in/ring-size-calculator)
- [Tanishq Online Store](https://www.tanishq.co.in/)
- [Tanishq App — Google Play](https://play.google.com/store/apps/details?id=com.titancompany.tanishqapp&hl=en_US)
- [BlueStone — BIS Hallmark](https://www.bluestone.com/jewellery-education/certification-guide/bis-hallmark)
- [BlueStone — Why Buy From Us](https://www.bluestone.com/whybuyfromus.html)
- [BlueStone FAQ](https://www.bluestone.com/faq.html)
- [CaratLane — Try at Home](https://www.caratlane.com/jewellery/try+at+home.html)
- [CaratLane — Design Your Own / Try-at-Home](https://www.caratlane.com/mounts-jewellery/try-at-home.html)
- [CaratLane Homepage](https://www.caratlane.com/)

---

## 3. User Personas

### Persona 1 — "Anika, the Wedding Shopper"
- 26–32, getting married within 6–12 months, shopping with family input.
- Buys high-value bridal sets (necklaces, bangles, bridal rings); decision involves
  parents/in-laws; trust and certification are non-negotiable.
- Pain points: showroom visits are time-consuming for out-of-town family; hard to
  compare bridal sets across brands; anxiety about hallmark authenticity online.
- Needs: certification visibility, large high-res imagery/zoom, easy
  multi-person sharing (wishlist sharing), EMI/financing for high ticket size.

### Persona 2 — "Rohan, the Gift Purchaser"
- 28–40, buying for spouse/partner/parent for an anniversary, birthday, or festival.
- Low jewellery domain knowledge; time-pressured; anxious about choosing wrong
  size/style and about return/exchange policy if it's wrong.
- Needs: a guided "gift finder" (recipient, occasion, budget → curated picks),
  gift wrapping, gift receipts (hide price), easy returns/exchange, fast delivery
  with date guarantee.

### Persona 3 — "Meera, the Luxury/Self-Buyer"
- 30–45, high disposable income, buys diamond/gold pieces for herself periodically,
  values design exclusivity and brand story over discounts.
- Needs: lookbooks/editorial content, "new collection" drops, detailed product
  storytelling (craftsmanship, gem sourcing), comparison tools, loyalty/early-access
  perks.

### Persona 4 — "Priya, the Returning/Everyday Customer"
- 22–35, buys lighter daily-wear pieces (studs, thin chains, stacking rings)
  repeatedly across the year, price-sensitive within a band, influenced by trends
  and social content.
- Needs: fast browsing/filtering, saved addresses/payment for quick re-checkout,
  order history/reorder, personalized recommendations based on past purchases,
  loyalty points, responsive mobile experience.

### Persona 5 (secondary, internal) — "Admin/Catalog Manager"
- Brand-side staff managing inventory, pricing (gold-rate-linked), promotions, and
  order fulfillment across the jewellery catalog.
- Needs: bulk catalog/inventory tools, real-time gold-rate-linked pricing controls,
  order/returns dashboard, analytics on conversion and AOV by category.

---

## 4. User Journeys

### Journey A — Wedding Shopper (Anika): Discovery → Bridal Set Purchase
1. Lands via Google/Instagram ad for "bridal collections" → Category landing page
   (Diamond/Gold Collections filtered to bridal).
2. Filters by budget, metal purity, occasion ("wedding").
3. Opens product detail → reviews certification badges, zooms images, reads
   craftsmanship story, checks reviews from verified buyers.
4. Adds to wishlist, shares wishlist link with mother/partner via WhatsApp.
5. Returns days later (logged in) → wishlist persisted → compares 2–3 sets using
   Product Comparison.
6. Adds to cart → applies EMI option at checkout → completes purchase with
   Razorpay/Stripe (stubbed) → receives order confirmation + certification docs.
7. Tracks order via Order Tracking; eventually may initiate a Return if sizing
   is wrong.

### Journey B — Gift Purchaser (Rohan): Guided Gift Discovery
1. Lands on homepage, clicks "Find a Gift" (Gift Recommendation Engine entry point).
2. Answers short flow: recipient (spouse), occasion (anniversary), budget band, style
   hints (recipient's existing jewellery photos optional).
3. Engine returns a curated shortlist (Personalized Collections + AI recommendation).
4. Picks a necklace, adds gift wrap + gift note, hides price on packing slip.
5. Checks out as guest or with quick signup; gets delivery-date guarantee before
   the occasion date.
6. Post-purchase: reminded via email (Resend) to leave a review; if recipient
   doesn't like it, uses a low-friction Return flow.

### Journey C — Luxury/Self-Buyer (Meera): Browse → Considered Purchase
1. Discovers a "New Collection" drop via newsletter/PostHog-tracked campaign.
2. Browses full collection lookbook page; uses Filters (gemstone, metal, price).
3. Uses Jewelry Try-On Preparation on 3 candidate pieces to visualize fit/look.
4. Adds favorites to Wishlist; uses Product Comparison across 2 rings.
5. Returns on a different device (logged in) → cart/wishlist sync.
6. Completes purchase; enrolls in loyalty/early-access program for future drops.

### Journey D — Everyday Returning Customer (Priya): Fast Repeat Purchase
1. Opens app/site already logged in (Auth.js session persisted).
2. Goes directly to "Recommended for you" (AI Product Recommendation) on homepage.
3. Applies saved filters (price band, daily-wear category).
4. Adds to cart, applies a Coupon code from a marketing email.
5. One-click checkout using saved address/payment method.
6. Tracks order; later reorders the same SKU from Order History.

### Journey E (Admin) — Catalog & Inventory Manager
1. Logs into Admin Dashboard.
2. Updates gold-rate-linked pricing rule for a category ahead of a rate change.
3. Adds a new product with images (uploaded to swappable storage provider),
   variants (metal/size), and inventory counts.
4. Reviews Analytics Dashboard for low-stock alerts and best-sellers.
5. Configures a new Discount/Coupon campaign via Discount Management.
6. Monitors incoming Orders, processes a Return/exchange request.

---

## 5. Functional Requirements

### Customer-Facing
- **FR-1 Authentication**: Email/social sign-up & login (Auth.js), guest checkout,
  password reset, session persistence across devices.
- **FR-2 Catalog Browsing**: Category pages, two levels deep (client-provided
  taxonomy, replacing the placeholder category list this FR originally
  named): **Rings** (Solitaire, Couple, Adjustable, Toe rings), **Earrings**
  (Jhumkas, Hoops, Studs, Oxidised Silver), **Necklaces & Pendants** (Heart
  pendants, Zodiac pendants, Spiritual pendants), **Bracelets & Anklets**
  (Charm bracelets, Nazariya, Kids' silver) — plus faceted Filters (metal,
  purity, gemstone, price band, occasion, gender), sort (price, popularity,
  new-in). Per-category item counts are still a placeholder pending real
  client inventory data.
- **FR-3 Search**: Full-text/typo-tolerant product search with autosuggest
  (Elasticsearch-backed).
- **FR-4 Product Detail Page**: High-res imagery/zoom, variant selection
  (metal/size/purity), certification badges, price (gold-rate-linked where
  applicable), stock status, Reviews, related/"shop similar" items.
- **FR-5 Reviews & Ratings**: Verified-purchase reviews, photo reviews, rating
  aggregation, moderation queue (admin side).
- **FR-6 Wishlist**: Add/remove, shareable wishlist link, persists across sessions.
- **FR-7 Cart**: Add/update/remove line items, quantity, gift-wrap/gift-note option,
  price breakdown (item, making charges, GST, shipping).
- **FR-8 Coupon System**: Apply/validate coupon codes, rule-based discounts
  (percentage, flat, category-specific, first-order).
- **FR-9 Checkout**: Address management, shipping method selection, payment via
  Stripe (live) / Razorpay (stub, inactive), order summary, EMI option placeholder.
- **FR-10 Order Tracking**: Order status timeline (placed → processing → shipped →
  delivered), shipment tracking reference.
- **FR-11 Returns**: Initiate return/exchange request, reason capture, return status
  tracking, refund status.
- **FR-12 Product Comparison**: Select up to N products, side-by-side spec/price
  comparison.
- **FR-13 Gift Recommendation Engine**: Guided questionnaire (recipient, occasion,
  budget, style) → curated product shortlist.
- **FR-14 Personalized Collections**: Logged-in-user-specific curated grids based on
  browsing/purchase history.
- **FR-15 AI Product Recommendation**: "Recommended for you" / "Frequently bought
  together" / "Similar items" surfaces, model-driven.
- **FR-16 Jewelry Try-On Preparation**: Capability to capture/upload a reference
  photo or use a sizing guide as a prerequisite step toward future AR try-on;
  Milestone 1 scope is the *data capture and UX flow*, not full AR rendering.

### Admin-Facing
- **FR-17 Product Management**: CRUD for products, variants, categories, images
  (via swappable storage provider).
- **FR-18 Inventory Management**: Stock levels per variant/SKU, low-stock alerts,
  multi-location support (future).
- **FR-19 Order Management**: Order list/detail, status updates, refund/return
  processing.
- **FR-20 User Management**: Customer account list, role assignment (admin/staff),
  account suspension.
- **FR-21 Analytics Dashboard**: Sales, conversion, AOV, top categories/products,
  cohort/retention views (PostHog-backed).
- **FR-22 Discount Management**: Create/edit/disable coupons and promotional rules.
- **FR-23 CMS**: Manage homepage banners, category landing content, lookbook/editorial
  pages without a code deploy.

---

## 6. Non-Functional Requirements

- **NFR-1 Performance**: P95 page load < 2.5s on 4G mobile for catalog/PDP pages;
  search results returned < 300ms (Elasticsearch).
- **NFR-2 Availability**: 99.9% uptime target for storefront and checkout path.
- **NFR-3 Scalability**: Horizontally scalable API (NestJS on ECS); cache hot
  catalog/category data in Redis to absorb festive-season traffic spikes
  (Diwali/wedding season is the Indian jewellery peak).
- **NFR-4 Security**: OWASP Top 10 compliance, PCI-DSS-aligned handling of payment
  data (delegated to Stripe/Razorpay, no raw card data stored), encrypted PII at
  rest, rate-limiting on auth/search endpoints.
- **NFR-5 Accessibility**: WCAG 2.1 AA across storefront (keyboard navigation, alt
  text for product imagery, color-contrast compliant on luxury dark/gold palette).
- **NFR-6 Mobile-First**: Majority of Indian e-commerce traffic is mobile; all flows
  designed mobile-first, then scaled up (per GLINT wireframe direction).
- **NFR-7 SEO**: Server-rendered category/PDP pages (Next.js), structured data
  (Product, Offer, Review schema.org markup), clean canonical URLs.
- **NFR-8 Observability**: Centralized metrics/logging via Prometheus/Grafana;
  business analytics via PostHog; alerting on checkout funnel error rates.
- **NFR-9 Data Portability**: Storage and payment provider abstractions ensure no
  hard vendor lock-in (S3 → standalone storage; Razorpay stub → swap-in without
  domain changes).
- **NFR-10 Internationalization-readiness**: Currency/locale formatting centralized
  even though India is the only region in MVP, to avoid rework if US/UAE expansion
  is requested later (CaratLane and Tanishq both already operate in the US).

---

## 7. MVP Scope

**Goal: reach feature parity with Tanishq/BlueStone/CaratLane's core transactional
loop, plus one visible AI differentiator, within the first shippable release.**

Included in MVP:
- Auth (FR-1), Catalog browsing + Filters (FR-2), Search (FR-3), PDP (FR-4),
  Reviews (FR-5, display only — moderation can be manual), Wishlist (FR-6),
  Cart (FR-7), Coupons (FR-8), Checkout with Stripe live + Razorpay stub (FR-9),
  Order Tracking (FR-10), Returns (FR-11).
- Admin: Product Management (FR-17), Inventory Management (FR-18), Order
  Management (FR-19), basic Analytics Dashboard (FR-21), Discount Management (FR-22).
- One AI differentiator to ship in MVP: **AI Product Recommendation** (FR-15,
  "recommended for you" + "shop similar" — the wireframe already has UI slots for
  this on homepage and PDP), since it requires the least net-new UX invention and
  reuses existing wireframe real estate.
- NFRs 1–8 apply to MVP (performance, security, accessibility, mobile-first, SEO,
  observability are not optional/deferred).

## 8. Future Scope (Post-MVP)

- Product Comparison (FR-12)
- Gift Recommendation Engine (FR-13)
- Personalized Collections beyond basic recommendations (FR-14)
- Jewelry Try-On Preparation / AR try-on (FR-16)
- CMS (FR-23) — admin can ship banner/content changes via deploys until then
- User Management roles beyond single-admin (FR-20 advanced RBAC)
- Multi-location inventory, EMI/financing integration, loyalty/rewards program
- Physical "Try at Home" logistics (explicitly out of scope — see Competitor
  Analysis takeaway #5)
- International expansion (US/UAE), multi-currency

---

## 9. Revenue Model

1. **Direct product sales (primary)** — margin on gold/diamond jewellery sales,
   the core transactional revenue, same as all three competitors.
2. **Making-charge/markup tiering** — transparent making-charge line item per
   product (industry-standard in Indian jewellery), enables price flexing without
   misrepresenting metal value.
3. **Coupon-funded promotional campaigns** — first-order discounts, festive
   campaigns (Diwali/wedding season) to drive acquisition, funded out of marketing
   budget against CAC targets, not structural discounting.
4. **Future: subscription/loyalty tier** — early access to drops + perks for
   high-frequency buyers (Persona "Priya"), deferred to Future Scope.
5. **Future: affiliate/gift-registry partnerships** — wedding registries, corporate
   gifting bulk orders (B2B channel), deferred to Future Scope.

---

## 10. Customer Acquisition Strategy

1. **SEO-led organic acquisition**: Category/PDP pages server-rendered with
   structured data to compete with Tanishq/BlueStone/CaratLane's established
   organic footprint (NFR-7); content hub (jewellery education, gifting guides)
   to capture top-of-funnel search intent the way BlueStone's blog does.
2. **Performance marketing around occasions**: Wedding season, Diwali, Valentine's,
   anniversaries — paid social/search timed to occasion-driven demand, landing
   directly on the Gift Recommendation Engine flow (high-intent, low-friction).
3. **Influencer/social-first for daily-wear segment**: Targets Persona "Priya"
   (trend-driven, lighter price point) via Instagram/short-video placements,
   consistent with how younger jewellery buyers discover BlueStone/CaratLane today.
4. **Referral/wishlist-sharing loops**: Wishlist sharing (Journey A) doubles as a
   built-in acquisition channel — family members invited into the funnel via shared
   links convert at higher trust than cold ads.
5. **Trust-building content for high-AOV buyers**: Certification transparency,
   craftsmanship storytelling, and verified reviews surfaced prominently on PDP to
   close the "online jewellery trust gap" that BlueStone explicitly built its
   positioning around.
6. **Retention via personalization (post-MVP)**: AI recommendations and
   personalized collections to lift repeat-purchase rate from Persona "Priya"
   segment, reducing blended CAC over time as repeat revenue share grows.

---

## 11. Open Questions for Milestone 2+

- Exact gold-rate data source/API for live pricing (affects pricing engine design).
- Whether returns require reverse-logistics integration in MVP or can be
  store-credit-only initially.
- Final decision on whether Reviews require purchase verification gating at MVP
  launch or can launch with unmoderated reviews + manual moderation queue.
