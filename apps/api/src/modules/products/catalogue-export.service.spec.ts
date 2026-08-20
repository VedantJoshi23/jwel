import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { CatalogueExportService } from './catalogue-export.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';

type MockPrisma = {
  category: { findFirst: jest.Mock };
  collection: { findUnique: jest.Mock };
  product: { findMany: jest.Mock };
  collectionProduct: { findMany: jest.Mock };
};

function fakeProduct(name: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name,
    variants: [{ basePriceMinorUnits: 250000 }],
    media: [{ storageRef: `local:products/${name}.jpg` }],
    category: { name: 'Rings', sortOrder: 0 },
    ...overrides,
  };
}

describe('CatalogueExportService', () => {
  let prisma: MockPrisma;
  let storage: { resolveUrl: jest.Mock };
  let service: CatalogueExportService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    prisma = {
      category: { findFirst: jest.fn() },
      collection: { findUnique: jest.fn() },
      product: { findMany: jest.fn() },
      collectionProduct: { findMany: jest.fn() },
    };
    storage = { resolveUrl: jest.fn((ref: string) => `https://cdn.example/${ref}`) };
    service = new CatalogueExportService(prisma as unknown as PrismaService, storage as unknown as StorageProviderPort);

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function assertIsPdf(buffer: Buffer) {
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  }

  describe('whole catalogue', () => {
    it('queries only published, non-deleted products with no category/collection filter', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('Gold Ring')]);

      const { buffer, filename } = await service.generatePdf({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ProductStatus.PUBLISHED, deletedAt: null } }),
      );
      expect(filename).toBe('full-catalogue-catalogue.pdf');
      assertIsPdf(buffer);
    });

    it('still produces a valid PDF when there are no published products', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      const { buffer } = await service.generatePdf({});

      assertIsPdf(buffer);
    });
  });

  describe('category scope', () => {
    it('throws NotFoundException for an unknown categoryId', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.generatePdf({ categoryId: 'missing' })).rejects.toThrow(NotFoundException);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('scopes the product query to the category and excludes drafts', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat1', name: 'Rings' });
      prisma.product.findMany.mockResolvedValue([fakeProduct('Gold Ring')]);

      const { buffer } = await service.generatePdf({ categoryId: 'cat1' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ProductStatus.PUBLISHED, deletedAt: null, categoryId: 'cat1' },
        }),
      );
      assertIsPdf(buffer);
    });
  });

  describe('collection scope', () => {
    it('throws NotFoundException for an unknown collectionId', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(service.generatePdf({ collectionId: 'missing' })).rejects.toThrow(NotFoundException);
      expect(prisma.collectionProduct.findMany).not.toHaveBeenCalled();
    });

    it('scopes to the collection via CollectionProduct and excludes drafts', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col1', name: 'Bestsellers' });
      prisma.collectionProduct.findMany.mockResolvedValue([{ product: fakeProduct('Silver Chain') }]);

      const { buffer } = await service.generatePdf({ collectionId: 'col1' });

      expect(prisma.collectionProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { collectionId: 'col1', product: { status: ProductStatus.PUBLISHED, deletedAt: null } },
        }),
      );
      assertIsPdf(buffer);
    });
  });

  describe('image handling', () => {
    it('still produces a PDF when an image fetch fails', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('Gold Ring')]);
      fetchMock.mockResolvedValue({ ok: false });

      const { buffer } = await service.generatePdf({});

      assertIsPdf(buffer);
    });

    it('still produces a PDF when a product has no media at all', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('Bare Ring', { media: [] })]);

      const { buffer } = await service.generatePdf({});

      expect(fetchMock).not.toHaveBeenCalled();
      assertIsPdf(buffer);
    });
  });
});
