export interface RecommendationItem {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  priceMinMinorUnits: number;
  avgRating: number;
  ratingCount: number;
  thumbnailRef: string | null;
}

export type RecommendationReason =
  | 'co_purchased' // bought together with something this identity purchased/viewed
  | 'category_affinity' // same category as past purchases
  | 'trending' // global recent-purchase popularity, used standalone and as cold-start fallback
  | 'bestseller'; // all-time rating-volume fallback when there's no recent purchase signal at all

export interface ScoredRecommendationItem extends RecommendationItem {
  reason: RecommendationReason;
}
