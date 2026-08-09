// Mirrors response shapes from apps/api (Milestone 5). Hand-duplicated here
// rather than imported from packages/types, which BACKEND.md §5 already flags
// as not yet wired up across the monorepo — tracked as a follow-up so frontend
// and backend types don't silently drift in the meantime.

export type MetalType = 'GOLD' | 'GOLD_PLATED' | 'SILVER' | 'PLATINUM' | 'STAINLESS_STEEL';
export type CertificationType = 'BIS_HALLMARK' | 'IGI' | 'GIA' | 'SGL' | 'HKD';
export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface ProductVariant {
  id: string;
  sku: string;
  metal: MetalType;
  purity: string | null;
  size: string | null;
  weightGrams: string;
  basePriceMinorUnits: number;
}

export interface ProductMedia {
  id: string;
  /** Opaque — resolved server-side by the Storage port. Never load this directly; use `url`. */
  storageRef: string;
  /** Resolved, directly loadable image URL — always present once the Storage port is wired up. */
  url: string;
  type: 'IMAGE' | 'VIDEO';
  sortOrder: number;
}

export interface Category {
  /** Null means the category has no size dimension, or inherits one. */
  sizeScheme?: SizeScheme | null;
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
}

export type CollectionType = 'GOLD' | 'DIAMOND' | 'SEASONAL' | 'EDITORIAL';

/**
 * FEAT-SIZE-TAXONOMY. `NONE` is a real value meaning "this category has no
 * size", as distinct from a null column meaning "inherit from parent" — see
 * DOM-CATALOG inv. 9. Both resolve to "show no size UI" on the client, but the
 * server needs the distinction to walk the category tree.
 */
export type SizeScheme =
  | 'NONE'
  | 'RING_INDIA'
  | 'BANGLE_INDIA'
  | 'CHAIN_LENGTH_MM'
  | 'BRACELET_LENGTH_MM';

export interface SizeOption {
  scheme: SizeScheme;
  /** Canonical value, matched against ProductVariant.size and the `size` filter. */
  value: string;
  /** What a customer reads — "16" for a ring, "45 cm (18\")" for a chain. */
  label: string;
  /**
   * Authoritative measurement. Serialised as a string, not a number: it is a
   * fixed-scale decimal and JSON numbers would drop the trailing zero.
   */
  circumferenceMm: string | null;
  diameterMm: string | null;
  usEquivalent: string | null;
  ukEquivalent: string | null;
  /**
   * Recovered from legacy free-text data rather than curated. Real and
   * filterable — a ring genuinely made at 16.5 is not a 16 — but never offered
   * when creating a new product (FEAT-SIZE-TAXONOMY criterion 10).
   */
  isCustom: boolean;
}

/**
 * A curated set that cuts across categories ("Diwali Edit", "Bridal
 * Lookbook"), as opposed to a Category, which is what a piece *is*.
 *
 * Both are addressed under /collections/[slug]; the API refuses to let a
 * collection and a category share a slug, in either direction.
 */
export interface Collection {
  id: string;
  name: string;
  slug: string;
  type: CollectionType;
  description: string | null;
  heroImageRef: string | null;
  heroImageUrl: string | null;
  isFeatured: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface AdminCollection extends Collection {
  _count?: { products: number };
}

export interface CollectionWithProducts extends Collection {
  products: PaginatedResult<Product>;
}

export interface Product {
  /**
   * Present only on the response that just published this product
   * (FEAT-PUBLISH-COMPLETENESS). Not persisted — recomputed each publish, so a
   * stored copy could not go stale.
   */
  publishWarnings?: string[];
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  certificationType: CertificationType | null;
  avgRating: string;
  ratingCount: number;
  category: Category;
  variants: ProductVariant[];
  media: ProductMedia[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: string;
  variantId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPriceMinorUnits: number;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  note: string | null;
  occurredAt: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  shippingMinorUnits: number;
  totalMinorUnits: number;
  items: OrderItem[];
  statusHistory?: OrderStatusHistoryEntry[];
  createdAt: string;
}

/**
 * Everything the browser needs to open Razorpay Checkout. Mirrors the API's
 * `CheckoutHandle` (payment-provider.port.ts) — only client-safe values:
 * `keyId` is a public key by design, and no secret is ever sent here.
 */
export interface CheckoutHandle {
  keyId: string;
  orderId: string;
  /**
   * True when no real gateway is behind this checkout, so the payment modal
   * must be skipped. The server decides this — see the note on the API's own
   * `CheckoutHandle`: a `PAYMENTS_MODE=simulated` deployment runs a production
   * web bundle against a mocked API, so no client-side check can tell.
   */
  simulated: boolean;
}

export interface CreateOrderResponse {
  orderId: string;
  totalMinorUnits: number;
  checkout: CheckoutHandle;
}

export interface CouponValidationResult {
  coupon: { id: string; code: string; discountType: string; value: number };
  discountMinorUnits: number;
}

// ── Admin Portal (Milestone 10) ─────────────────────────────────────────────

export interface AdminOrder extends Order {
  user: { id: string; email: string; name: string | null };
  /**
   * Some but not all of this order's items have been refunded
   * (DOM-RETURNS invariant 9).
   *
   * Derived by the API per read, never stored. A partially refunded order
   * stays `DELIVERED` in the data model deliberately — there is no
   * `PARTIALLY_REFUNDED` status — so without this flag an admin cannot tell
   * it apart from an order that was never returned, short of opening it.
   */
  partiallyReturned: boolean;
}

/**
 * A line in the server-side cart.
 *
 * Its **id** is the line, not the variant: the same variant can appear twice
 * with different gift options, which `DOM-SHOPPING` Invariant 1 makes two
 * distinct lines.
 */
export interface ServerCartLine {
  id: string;
  variantId: string;
  quantity: number;
  /** The price when the line was created — Invariant 3, not today's price. */
  priceSnapshotMinorUnits: number;
  /** Per line, not per cart — Invariant 4. */
  giftWrap: boolean;
  giftNote: string | null;
  variant: {
    id: string;
    sku: string;
    metal: string;
    size: string | null;
    basePriceMinorUnits: number;
    product: { id: string; name: string; slug: string };
  };
}

export interface ServerCart {
  id: string;
  userId: string | null;
  guestToken: string | null;
  items: ServerCartLine[];
}

/** What `POST /cart/claim` did — see DOM-SHOPPING Invariants 6, 12 and 17. */
export interface CartClaimResult {
  outcome: 'nothing_to_claim' | 'adopted' | 'merged' | 'replaced' | 'conflict';
  cart: ServerCart;
  /** Present only on `conflict`, so the prompt can describe what is at stake. */
  guestCart?: ServerCart;
}

/** One result from the search module — mirrors the API's `SearchHit`. */
export interface SearchHit {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  priceMinMinorUnits: number;
  priceMaxMinorUnits: number;
  avgRating: number;
  ratingCount: number;
  inStock: boolean;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  /**
   * Computed by Elasticsearch only — the Postgres fallback returns them empty,
   * which is a real capability loss rather than a transparent equivalent
   * (`DOM-SEARCH` property 2).
   */
  facets: {
    metals: FacetBucket[];
    categories: FacetBucket[];
    certifications: FacetBucket[];
    priceRanges: FacetBucket[];
  };
}

export interface AutocompleteSuggestion {
  productId: string;
  slug: string;
  name: string;
}

/** Mirrors the API's `RecommendationItem` — a product summary for a rail. */
export interface RecommendedProduct {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  priceMinMinorUnits: number;
  avgRating: number;
  ratingCount: number;
  thumbnailRef: string | null;
  /** Present only on the personalised rail, which explains why it chose each item. */
  reason?: 'co_purchased' | 'category_affinity' | 'trending' | 'bestseller';
}

export interface WishlistItem {
  id: string;
  variantId: string;
  addedAt: string;
  variant: {
    id: string;
    sku: string;
    metal: string;
    size: string | null;
    basePriceMinorUnits: number;
    product: {
      id: string;
      name: string;
      slug: string;
      /**
       * Present on the owner's own wishlist, absent from a shared one — the
       * share endpoint filters unpublished products out entirely rather than
       * exposing them on a public URL.
       */
      status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
      deletedAt?: string | null;
    };
  };
}

export interface Wishlist {
  id: string;
  /**
   * The share link's only credential. Unguessable, and `DOM-SHOPPING`
   * Invariant 9 makes what it opens read-only.
   */
  shareToken: string;
  items: WishlistItem[];
}

/**
 * What a share link returns: items and nothing else. The API omits the owner
 * entirely rather than trusting the client not to render it (Invariant 9).
 */
export interface SharedWishlist {
  items: WishlistItem[];
}

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUND_PROCESSING' | 'REFUNDED';

export type ReturnReason =
  | 'SIZE_ISSUE'
  | 'DAMAGED'
  | 'NOT_AS_DESCRIBED'
  | 'CHANGED_MIND'
  | 'OTHER';

/**
 * A return as the customer sees it. Same rows as `AdminReturn`, without the
 * other customer's details.
 */
export interface CustomerReturn {
  id: string;
  reason: ReturnReason;
  notes: string | null;
  status: ReturnStatus;
  refundAmountMinorUnits: number | null;
  createdAt: string;
  orderItem: {
    id: string;
    orderId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPriceMinorUnits: number;
  };
}

export interface AdminReturn {
  id: string;
  reason: 'SIZE_ISSUE' | 'DAMAGED' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND' | 'OTHER';
  notes: string | null;
  status: ReturnStatus;
  refundAmountMinorUnits: number | null;
  createdAt: string;
  orderItem: {
    id: string;
    orderId: string;
    productNameSnapshot: string;
    quantity: number;
    unitPriceMinorUnits: number;
    order: { user: { email: string } };
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
  deletedAt: string | null;
}

export interface InventoryItem {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
}

export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'FIRST_ORDER';

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  minOrderAmountMinorUnits: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  imageRef: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

/**
 * What `GET /cms/banners` returns: a Banner plus the resolved `imageUrl`.
 *
 * Separate from `Banner` rather than an optional field on it, because the
 * admin endpoints genuinely do not return `imageUrl` — only the public feed
 * resolves refs. An optional field would let a storefront component read
 * `banner.imageUrl` off an admin response and get `undefined` at runtime with
 * no type error.
 */
export interface ActiveBanner extends Banner {
  imageUrl: string;
}

export interface TopProduct {
  productId: string;
  name: string;
  /** Units that left the shelf, not units kept. */
  unitsSold: number;
  grossMinorUnits: number;
  refundsMinorUnits: number;
  /** What this product actually contributed. The API ranks on this. */
  netMinorUnits: number;
}

export interface DashboardSummary {
  windowDays: number;
  /**
   * DOM-REPORTING invariant 4 — three figures, never one. A single number
   * that fell last month is unexplainable; the split says whether trade
   * slowed or returns rose.
   */
  grossMinorUnits: number;
  refundsMinorUnits: number;
  netMinorUnits: number;
  orderCount: number;
  averageOrderValueMinorUnits: number;
  ordersByStatus: Record<string, number>;
  topProducts: TopProduct[];
  lowStockCount: number;
  pendingReviewsCount: number;
  newCustomers: number;
}

export interface BulkImportResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId: string;
  timestamp: string;
}
