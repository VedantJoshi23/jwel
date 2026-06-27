export const PRODUCTS_INDEX = 'jwel_products';

// Inline synonyms, not a synonyms_path file — portable across environments
// (a file-based synonym set requires the file to live relative to the ES
// config dir, which is awkward to ship/deploy consistently). Grouped by
// PRODUCT.md's catalog taxonomy (Rings, Earrings, Necklaces, Bracelets,
// Pendants) plus the occasion/marketing language buyers actually search with
// (Journey A: "bridal"). Equivalence sets (a, b, c) match any of a/b/c for
// any of a/b/c — broader recall, which is the right tradeoff for a catalog
// this size; revisit with directional synonyms (a => b) if/when false-positive
// matches show up in real query logs.
const JEWELRY_SYNONYMS = [
  'ring, rings, band, bands',
  'earring, earrings, ear stud, ear studs, stud, studs',
  'hoop, hoops, hoop earring, hoop earrings',
  'necklace, necklaces, chain, chains',
  'bracelet, bracelets, bangle, bangles',
  'pendant, pendants, locket, lockets',
  'bridal, wedding, marriage',
  'engagement, solitaire',
  'gold, golden',
  'diamond, diamonds',
  'anklet, anklets, payal',
];

export const PRODUCTS_INDEX_SETTINGS = {
  settings: {
    // 0 replicas: correct for a single-node dev cluster (the default of 1
    // replica can never be assigned with only one node, which leaves the
    // cluster permanently `yellow`). A real multi-node deployment should
    // raise this — tracked alongside the other dev-only ES settings called
    // out in BACKEND.md §8.6.
    number_of_replicas: 0,
    analysis: {
      filter: {
        jewelry_synonyms: {
          type: 'synonym_graph',
          synonyms: JEWELRY_SYNONYMS,
        },
        edge_ngram_filter: {
          type: 'edge_ngram',
          min_gram: 1,
          max_gram: 20,
        },
      },
      analyzer: {
        // Used at index+search time for full-text fields (description,
        // category name) — synonym expansion improves recall for "bridal
        // necklace" matching a product titled "Wedding Necklace", etc.
        jewelry_text_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'jewelry_synonyms'],
        },
        // Synonyms must NOT be applied at search time for a search_as_you_type
        // prefix query (it can produce confusing partial-token matches), so
        // `name` uses the plain standard analyzer; synonym recall on product
        // names is instead handled by the description/category fields and by
        // query-time multi_match across those fields too (see search.service.ts).
        standard_lowercase: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      productId: { type: 'keyword' },
      slug: { type: 'keyword' },
      name: {
        type: 'search_as_you_type', // gives name, name._2gram, name._3gram, name._index_prefix — the standard ES pattern for combined autocomplete + typo-tolerant full-text on one field
        analyzer: 'standard_lowercase',
      },
      description: {
        type: 'text',
        analyzer: 'jewelry_text_analyzer',
      },
      categorySlug: { type: 'keyword' },
      categoryName: {
        type: 'text',
        analyzer: 'jewelry_text_analyzer',
        fields: { keyword: { type: 'keyword' } },
      },
      metal: { type: 'keyword' }, // array of MetalType across variants
      purity: { type: 'keyword' },
      certificationType: { type: 'keyword' },
      priceMinMinorUnits: { type: 'long' },
      priceMaxMinorUnits: { type: 'long' },
      avgRating: { type: 'float' },
      ratingCount: { type: 'integer' },
      inStock: { type: 'boolean' },
      isBestseller: { type: 'boolean' }, // derived: ratingCount above a threshold — a real "bestseller" flag belongs to a future Analytics-driven definition (ARCHITECTURE.md Analytics module), this is a placeholder heuristic
      createdAt: { type: 'date' },
    },
  },
};
