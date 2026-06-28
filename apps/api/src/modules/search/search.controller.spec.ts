import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductsService } from '../products/products.service';

describe('SearchController', () => {
  let search: { search: jest.Mock; autocomplete: jest.Mock; reindexAll: jest.Mock };
  let products: { findAll: jest.Mock };
  let controller: SearchController;

  beforeEach(() => {
    search = { search: jest.fn(), autocomplete: jest.fn(), reindexAll: jest.fn().mockReturnValue('reindexed') };
    products = { findAll: jest.fn() };
    controller = new SearchController(search as unknown as SearchService, products as unknown as ProductsService);
  });

  describe('search', () => {
    it('returns the Elasticsearch result directly when it succeeds', async () => {
      search.search.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24, facets: {} });
      const result = await controller.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, facets: {} });
      expect(products.findAll).not.toHaveBeenCalled();
    });

    it('falls back to Postgres (with empty facets) when Elasticsearch throws', async () => {
      search.search.mockRejectedValue(new Error('ES is down'));
      products.findAll.mockResolvedValue({
        items: [
          {
            id: 'p1',
            slug: 'gold-ring',
            name: 'Gold Ring',
            category: { slug: 'rings', name: 'Rings' },
            variants: [{ basePriceMinorUnits: 1000 }, { basePriceMinorUnits: 2000 }],
            avgRating: '4.5',
            ratingCount: 3,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 24,
      });

      const result = await controller.search({ q: 'ring', page: 1, pageSize: 24 } as any);

      expect(result.facets).toEqual({ metals: [], categories: [], certifications: [], priceRanges: [] });
      expect(result.items[0]).toMatchObject({
        productId: 'p1',
        slug: 'gold-ring',
        priceMinMinorUnits: 1000,
        priceMaxMinorUnits: 2000,
        inStock: true,
      });
    });
  });

  describe('autocomplete', () => {
    it('returns suggestions directly when Elasticsearch succeeds', async () => {
      search.autocomplete.mockResolvedValue([{ productId: 'p1', slug: 'x', name: 'X' }]);
      expect(await controller.autocomplete({ q: 'go', limit: 8 } as any)).toEqual([
        { productId: 'p1', slug: 'x', name: 'X' },
      ]);
    });

    it('degrades to an empty array (not an error) when Elasticsearch is down', async () => {
      search.autocomplete.mockRejectedValue(new Error('ES is down'));
      expect(await controller.autocomplete({ q: 'go', limit: 8 } as any)).toEqual([]);
    });
  });

  describe('reindex', () => {
    it('delegates to SearchService.reindexAll', () => {
      expect(controller.reindex()).toBe('reindexed');
    });
  });
});
