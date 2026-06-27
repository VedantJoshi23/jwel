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

export interface PriceRangeBucket {
  from?: number;
  to?: number;
  count: number;
}

export interface SearchFacets {
  metals: FacetBucket[];
  categories: FacetBucket[];
  certifications: FacetBucket[];
  priceRanges: PriceRangeBucket[];
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

export interface AutocompleteSuggestion {
  productId: string;
  slug: string;
  name: string;
}
