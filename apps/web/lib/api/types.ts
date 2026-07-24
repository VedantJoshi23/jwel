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
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
}

export interface Product {
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

export interface CreateOrderResponse {
  orderId: string;
  totalMinorUnits: number;
  clientSecret: string;
}

export interface CouponValidationResult {
  coupon: { id: string; code: string; discountType: string; value: number };
  discountMinorUnits: number;
}

// ── Admin Portal (Milestone 10) ─────────────────────────────────────────────

export interface AdminOrder extends Order {
  user: { id: string; email: string; name: string | null };
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

export interface TopProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenueMinorUnits: number;
}

export interface DashboardSummary {
  windowDays: number;
  revenueMinorUnits: number;
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
