import { Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { ProductsService } from '../products/products.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { SearchResult } from './search.types';

@ApiTags('search')
@Controller('api/v1')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly productsService: ProductsService,
  ) {}

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search products — autocomplete-aware ranking, typo tolerance, facets (Milestone 8)',
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    try {
      return await this.searchService.search(query);
    } catch (error) {
      // Elasticsearch unreachable — degrade to the Postgres trigram fallback
      // path ARCHITECTURE.md/DATABASE.md always specified for this case,
      // rather than 500ing the customer-facing search box. No facets in the
      // fallback (Postgres aggregation for facets isn't implemented — ES is
      // the only place that computes them), which is a real capability loss,
      // not a transparent equivalent; logged loudly so it's visible in ops.
      this.logger.error(`Elasticsearch search failed, falling back to Postgres: ${(error as Error).message}`);
      const fallback = await this.productsService.findAll({
        q: query.q,
        category: query.category,
        metal: query.metal,
        priceMin: query.priceMin,
        priceMax: query.priceMax,
        page: query.page,
        pageSize: query.pageSize,
      });
      return {
        items: fallback.items.map((p) => ({
          productId: p.id,
          slug: p.slug,
          name: p.name,
          categorySlug: p.category.slug,
          categoryName: p.category.name,
          priceMinMinorUnits: Math.min(...p.variants.map((v) => v.basePriceMinorUnits)),
          priceMaxMinorUnits: Math.max(...p.variants.map((v) => v.basePriceMinorUnits)),
          avgRating: Number(p.avgRating),
          ratingCount: p.ratingCount,
          inStock: true,
        })),
        total: fallback.total,
        page: fallback.page,
        pageSize: fallback.pageSize,
        facets: { metals: [], categories: [], certifications: [], priceRanges: [] },
      };
    }
  }

  @Public()
  @Get('search/autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions as the user types' })
  async autocomplete(@Query() query: AutocompleteQueryDto) {
    try {
      return await this.searchService.autocomplete(query.q, query.limit);
    } catch (error) {
      this.logger.warn(`Autocomplete unavailable (Elasticsearch down): ${(error as Error).message}`);
      return [];
    }
  }

  @ApiBearerAuth()
  @Post('admin/search/reindex')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Rebuild the search index from PostgreSQL (DATABASE.md §5)' })
  reindex() {
    return this.searchService.reindexAll();
  }
}
