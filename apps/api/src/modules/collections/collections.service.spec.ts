import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CollectionType } from '@prisma/client';
import { CollectionsService } from './collections.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';

type MockPrisma = {
  collection: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  category: { findUnique: jest.Mock };
  collectionProduct: { findMany: jest.Mock; count: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
  product: { count: jest.Mock };
  $transaction: jest.Mock;
};

function baseDto(overrides = {}) {
  return { name: 'Diwali Edit', type: CollectionType.SEASONAL, ...overrides };
}

describe('CollectionsService', () => {
  let prisma: MockPrisma;
  let storage: { upload: jest.Mock; delete: jest.Mock; resolveUrl: jest.Mock };
  let service: CollectionsService;

  beforeEach(() => {
    prisma = {
      collection: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'c1', heroImageRef: null }),
        update: jest.fn().mockResolvedValue({ id: 'c1', heroImageRef: null }),
        delete: jest.fn(),
      },
      category: { findUnique: jest.fn().mockResolvedValue(null) },
      collectionProduct: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      product: { count: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    storage = { upload: jest.fn(), delete: jest.fn(), resolveUrl: jest.fn((ref: string) => `https://cdn.example/${ref}`) };
    service = new CollectionsService(prisma as unknown as PrismaService, storage as unknown as StorageProviderPort);
  });

  describe('slug collision guard', () => {
    // The whole reason /collections/[slug] can safely resolve two models.
    it('refuses a slug an existing category already uses', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat1', name: 'Rings', slug: 'rings' });

      await expect(service.adminCreate(baseDto({ name: 'Rings' }))).rejects.toThrow(BadRequestException);
      expect(prisma.collection.create).not.toHaveBeenCalled();
    });

    it('names the shadowed category in the error, so the operator can pick another slug', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat1', name: 'Rings', slug: 'rings' });
      await expect(service.adminCreate(baseDto({ name: 'Rings' }))).rejects.toThrow(/category "Rings"/);
    });

    it.each(['all', 'new-arrivals', 'bestsellers'])(
      'refuses "%s", which the storefront route answers before any lookup',
      async (slug) => {
        await expect(service.adminCreate(baseDto({ name: slug }))).rejects.toThrow(BadRequestException);
      },
    );

    it('refuses a slug another collection already holds', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'other', slug: 'diwali-edit' });
      await expect(service.adminCreate(baseDto())).rejects.toThrow(/already exists/);
    });

    it('lets a collection keep its own slug on update', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'c1', slug: 'diwali-edit', heroImageRef: null });
      await expect(service.adminUpdate('c1', baseDto({ slug: 'diwali-edit' }))).resolves.toBeDefined();
      expect(prisma.collection.update).toHaveBeenCalled();
    });

    it('checks the guard against the derived slug, not the raw name', async () => {
      await service.adminCreate(baseDto({ name: 'Diwali Edit' }));
      expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { slug: 'diwali-edit' } });
    });

    it('rejects a name with no alphanumeric characters at all', async () => {
      await expect(service.adminCreate(baseDto({ name: '!!!' }))).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPublicBySlug', () => {
    // Not a throw: every category URL on the storefront produces this, and the
    // route falls back to its category behaviour on null.
    it('returns null for a slug that is not a live collection', async () => {
      prisma.collection.findFirst.mockResolvedValue(null);
      await expect(service.findPublicBySlug('rings', { page: 1, pageSize: 24 })).resolves.toBeNull();
    });

    it('filters by the scheduling window, so a queued collection is not reachable early', async () => {
      prisma.collection.findFirst.mockResolvedValue(null);
      await service.findPublicBySlug('diwali-edit', { page: 1, pageSize: 24 });

      const where = prisma.collection.findFirst.mock.calls[0][0].where;
      expect(where.OR).toEqual(expect.arrayContaining([{ startsAt: null }]));
    });

    it('lists only published, non-deleted products', async () => {
      prisma.collection.findFirst.mockResolvedValue({ id: 'c1', slug: 'diwali-edit', heroImageRef: null });
      await service.findPublicBySlug('diwali-edit', { page: 1, pageSize: 24 });

      const where = prisma.collectionProduct.findMany.mock.calls[0][0].where;
      expect(where.product).toEqual({ status: 'PUBLISHED', deletedAt: null });
    });
  });

  describe('hero image', () => {
    it('resolves heroImageRef through the storage port', async () => {
      prisma.collection.findMany.mockResolvedValue([{ id: 'c1', heroImageRef: 'local:collections/a.jpg' }]);
      const [collection] = await service.listPublic();
      expect(collection.heroImageUrl).toBe('https://cdn.example/local:collections/a.jpg');
    });

    it('leaves heroImageUrl null when no hero is set, rather than resolving an empty ref', async () => {
      prisma.collection.findMany.mockResolvedValue([{ id: 'c1', heroImageRef: null }]);
      const [collection] = await service.listPublic();
      expect(collection.heroImageUrl).toBeNull();
      expect(storage.resolveUrl).not.toHaveBeenCalled();
    });
  });

  describe('product membership', () => {
    it('rejects the whole write if any product id does not exist', async () => {
      prisma.product.count.mockResolvedValue(1);
      await expect(
        service.adminCreate(baseDto({ productIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] })),
      ).rejects.toThrow(/do not exist/);
    });

    it('replaces membership in one transaction, not a delete then a separate insert', async () => {
      prisma.product.count.mockResolvedValue(1);
      await service.adminCreate(baseDto({ productIds: ['11111111-1111-4111-8111-111111111111'] }));

      // A partial diff would leave the collection half-updated if the insert
      // failed after the delete.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.collectionProduct.deleteMany).toHaveBeenCalled();
      expect(prisma.collectionProduct.createMany).toHaveBeenCalled();
    });

    it('leaves membership untouched when productIds is omitted', async () => {
      await service.adminCreate(baseDto());
      expect(prisma.collectionProduct.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('adminDelete', () => {
    it('throws when the collection does not exist', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.adminDelete('missing')).rejects.toThrow(NotFoundException);
    });

    it('hard deletes — nothing historical references a collection', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'c1' });
      await service.adminDelete('c1');
      expect(prisma.collection.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });
});
