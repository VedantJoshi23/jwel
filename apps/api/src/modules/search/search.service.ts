import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { ES_CLIENT } from './es-client.provider';
import { PRODUCTS_INDEX, PRODUCTS_INDEX_SETTINGS } from './mappings/products-index.mapping';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteSuggestion, FacetBucket, SearchFacets, SearchResult } from './search.types';

const productForIndexInclude = {
  category: true,
  variants: { include: { inventory: true } },
};

// Bands chosen for an Indian jewelry catalog's actual price spread (daily-wear
// studs at a few hundred rupees up through bridal sets) — see PRODUCT.md
// personas. Minor units (paise), matching DATABASE.md's money convention.
const PRICE_RANGE_BANDS: { from?: number; to?: number }[] = [
  { to: 100_000 }, // < ₹1,000
  { from: 100_000, to: 300_000 }, // ₹1,000 – ₹3,000
  { from: 300_000, to: 1_000_000 }, // ₹3,000 – ₹10,000
  { from: 1_000_000, to: 5_000_000 }, // ₹10,000 – ₹50,000
  { from: 5_000_000 }, // ₹50,000+
];

const BESTSELLER_RATING_COUNT_THRESHOLD = 20;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(ES_CLIENT) private readonly es: Client,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
    } catch (error) {
      // Elasticsearch being down at boot must not crash the whole API — the
      // rest of the app (including the Postgres-backed catalog fallback) has
      // to keep working. See SearchController for the customer-facing fallback.
      this.logger.warn(`Elasticsearch unavailable at startup: ${(error as Error).message}`);
    }

    // Catalog -> Search sync per ARCHITECTURE.md §5.3, now wired through the
    // event bus instead of remaining a documented-but-unimplemented diagram.
    // A handler failure here (e.g. ES down) is caught by EventBusService and
    // logged, never thrown back into the publisher (ProductsService/
    // ReviewsService) — a stale search index must never break a catalog edit.
    this.eventBus.on('product.upserted', (payload) => this.indexProduct(payload.productId));
    this.eventBus.on('product.deleted', (payload) => this.deleteProduct(payload.productId));
  }

  private async ensureIndex(): Promise<void> {
    const { body: exists } = await this.es.indices.exists({ index: PRODUCTS_INDEX });
    if (!exists) {
      await this.es.indices.create({ index: PRODUCTS_INDEX, body: PRODUCTS_INDEX_SETTINGS });
      this.logger.log(`Created Elasticsearch index "${PRODUCTS_INDEX}"`);
    }
  }

  private toDocument(product: NonNullable<Awaited<ReturnType<typeof this.fetchProductForIndexing>>>) {
    const variants = product.variants;
    const prices = variants.map((v) => v.basePriceMinorUnits);
    const inStock = variants.some((v) => v.inventory && v.inventory.quantityOnHand - v.inventory.quantityReserved > 0);

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      categorySlug: product.category.slug,
      categoryName: product.category.name,
      metal: Array.from(new Set(variants.map((v) => v.metal))),
      purity: Array.from(new Set(variants.map((v) => v.purity).filter(Boolean))) as string[],
      certificationType: product.certificationType,
      priceMinMinorUnits: prices.length ? Math.min(...prices) : 0,
      priceMaxMinorUnits: prices.length ? Math.max(...prices) : 0,
      avgRating: Number(product.avgRating),
      ratingCount: product.ratingCount,
      inStock,
      isBestseller: product.ratingCount >= BESTSELLER_RATING_COUNT_THRESHOLD,
      createdAt: product.createdAt,
    };
  }

  private fetchProductForIndexing(productId: string) {
    return this.prisma.product.findUnique({ where: { id: productId }, include: productForIndexInclude });
  }

  async indexProduct(productId: string): Promise<void> {
    const product = await this.fetchProductForIndexing(productId);
    if (!product || product.status !== ProductStatus.PUBLISHED || product.deletedAt) {
      await this.deleteProduct(productId);
      return;
    }
    const document = this.toDocument(product);
    await this.es.index({ index: PRODUCTS_INDEX, id: productId, body: document, refresh: 'wait_for' });
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.es.delete({ index: PRODUCTS_INDEX, id: productId, refresh: 'wait_for' });
    } catch (error: any) {
      if (error?.meta?.statusCode !== 404) {
        throw error;
      }
    }
  }

  async reindexAll(): Promise<{ indexed: number }> {
    await this.ensureIndex();
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.PUBLISHED, deletedAt: null },
      include: productForIndexInclude,
    });

    if (products.length === 0) {
      return { indexed: 0 };
    }

    const operations = products.flatMap((product) => [
      { index: { _index: PRODUCTS_INDEX, _id: product.id } },
      this.toDocument(product),
    ]);
    const { body } = await this.es.bulk({ refresh: true, body: operations });
    if (body.errors) {
      const failed = body.items.filter((item: any) => item.index?.error);
      this.logger.error(`Bulk reindex had ${failed.length} failures: ${JSON.stringify(failed.slice(0, 3))}`);
    }
    return { indexed: products.length };
  }

  /**
   * Ranking (function_score): text relevance first (search_as_you_type's
   * generated n-gram subfields give partial/typo-tolerant matching on
   * `name`; `fuzziness: AUTO` catches single/double-character typos beyond
   * that — "daimond" still finds "diamond"), then multiplied by a popularity
   * signal (ratingCount, log-dampened so one runaway bestseller doesn't drown
   * out everything else) and a small in-stock boost — a perfectly-matching
   * out-of-stock item should still outrank a loosely-matching in-stock one,
   * hence boost_mode: multiply with a modest 1.15x weight, not a filter.
   */
  async search(dto: SearchQueryDto): Promise<SearchResult> {
    const { q, page, pageSize, category, metal, certification, priceMin, priceMax } = dto;

    const filters: Record<string, unknown>[] = [];
    if (category) filters.push({ term: { categorySlug: category } });
    if (metal) filters.push({ term: { metal } });
    if (certification) filters.push({ term: { certificationType: certification } });
    if (priceMin !== undefined || priceMax !== undefined) {
      filters.push({
        range: {
          priceMinMinorUnits: { ...(priceMin !== undefined && { gte: priceMin }), ...(priceMax !== undefined && { lte: priceMax }) },
        },
      });
    }

    const body = {
      query: {
        function_score: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: q,
                    type: 'best_fields',
                    fields: ['name^4', 'name._2gram^3', 'name._3gram^2', 'categoryName^2', 'description'],
                    fuzziness: 'AUTO',
                    prefix_length: 1,
                  },
                },
              ],
              filter: filters,
            },
          },
          functions: [
            { field_value_factor: { field: 'ratingCount', modifier: 'log1p', factor: 1, missing: 0 } },
            { filter: { term: { inStock: true } }, weight: 1.15 },
          ],
          score_mode: 'sum',
          boost_mode: 'multiply',
        },
      },
      from: (page - 1) * pageSize,
      size: pageSize,
      aggs: {
        metals: { terms: { field: 'metal', size: 10 } },
        categories: { terms: { field: 'categorySlug', size: 20 } },
        certifications: { terms: { field: 'certificationType', size: 10 } },
        priceRanges: { range: { field: 'priceMinMinorUnits', ranges: PRICE_RANGE_BANDS } },
      },
    };

    const { body: response } = await this.es.search({ index: PRODUCTS_INDEX, body });

    const items = response.hits.hits.map((hit: any) => ({ ...hit._source }));
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total.value;

    return { items, total, page, pageSize, facets: this.parseFacets(response.aggregations) };
  }

  private parseFacets(aggregations: any): SearchFacets {
    const toBuckets = (agg: any): FacetBucket[] =>
      (agg?.buckets ?? []).map((b: any) => ({ value: String(b.key), count: b.doc_count }));

    return {
      metals: toBuckets(aggregations?.metals),
      categories: toBuckets(aggregations?.categories),
      certifications: toBuckets(aggregations?.certifications),
      priceRanges: (aggregations?.priceRanges?.buckets ?? []).map((b: any) => ({
        from: b.from,
        to: b.to,
        count: b.doc_count,
      })),
    };
  }

  /**
   * Autocomplete uses `bool_prefix` — the canonical query type for a
   * `search_as_you_type` field — across name/name._2gram/name._3gram, so
   * "gold ch" matches "Gold Chain" even mid-word, with no separate
   * completion-suggester index to keep in sync.
   */
  async autocomplete(q: string, limit: number): Promise<AutocompleteSuggestion[]> {
    const { body: response } = await this.es.search({
      index: PRODUCTS_INDEX,
      body: {
        size: limit,
        _source: ['productId', 'slug', 'name'],
        query: {
          multi_match: {
            query: q,
            type: 'bool_prefix',
            fields: ['name', 'name._2gram', 'name._3gram'],
          },
        },
      },
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }
}
