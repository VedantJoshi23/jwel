import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';
import { ProductSort } from './dto/query-products.dto';

type MockPrisma = {
  product: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock };
  productMedia: { count: jest.Mock; create: jest.Mock; delete: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  productVariant: { findUnique: jest.Mock; update: jest.Mock };
  category: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

function fakeProduct(id: string, basePriceMinorUnits: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    name: `Product ${id}`,
    ratingCount: 0,
    createdAt: new Date('2026-01-01'),
    variants: [{ basePriceMinorUnits }],
    media: [],
    ...overrides,
  };
}

describe('ProductsService', () => {
  let prisma: MockPrisma;
  let eventBus: { emit: jest.Mock };
  let storage: { upload: jest.Mock; delete: jest.Mock; resolveUrl: jest.Mock };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      productMedia: { count: jest.fn(), create: jest.fn(), delete: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      productVariant: { findUnique: jest.fn(), update: jest.fn() },
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      // Prisma's $transaction has two forms and this service uses both: an
      // array of operations (reorderMedia) and an interactive callback
      // (adminUpdate). Handle each, or the callback form gets passed to
      // Promise.all and throws "function is not iterable".
      $transaction: jest.fn((opsOrFn) =>
        typeof opsOrFn === 'function' ? opsOrFn(prisma) : Promise.all(opsOrFn),
      ),
    };
    eventBus = { emit: jest.fn() };
    storage = {
      upload: jest.fn().mockResolvedValue({ storageRef: 'local:products/new.jpg' }),
      delete: jest.fn(),
      resolveUrl: jest.fn((ref: string) => `https://cdn.example.com/${ref}`),
    };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBusService,
      storage as unknown as StorageProviderPort,
    );
  });

  describe('findAll', () => {
    it('filters out products below priceMin and above priceMax (computed from min variant price)', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('cheap', 500),
        fakeProduct('mid', 5000),
        fakeProduct('expensive', 50000),
      ]);

      const result = await service.findAll({ page: 1, pageSize: 10, priceMin: 1000, priceMax: 10000 } as any);

      expect(result.items.map((p) => p.id)).toEqual(['mid']);
      expect(result.total).toBe(1);
    });

    it('sorts by PRICE_ASC using each product’s minimum variant price', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('b', 3000), fakeProduct('a', 1000)]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.PRICE_ASC } as any);
      expect(result.items.map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('sorts by PRICE_DESC', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('a', 1000), fakeProduct('b', 3000)]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.PRICE_DESC } as any);
      expect(result.items.map((p) => p.id)).toEqual(['b', 'a']);
    });

    it('sorts by POPULARITY using ratingCount', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('low', 100, { ratingCount: 2 }),
        fakeProduct('high', 100, { ratingCount: 50 }),
      ]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.POPULARITY } as any);
      expect(result.items.map((p) => p.id)).toEqual(['high', 'low']);
    });

    it('defaults to NEWEST-first when no sort is given', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('older', 100, { createdAt: new Date('2026-01-01') }),
        fakeProduct('newer', 100, { createdAt: new Date('2026-06-01') }),
      ]);
      const result = await service.findAll({ page: 1, pageSize: 10 } as any);
      expect(result.items.map((p) => p.id)).toEqual(['newer', 'older']);
    });

    it('treats a product with zero variants as price 0, not a crash', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('novariant', 0, { variants: [] })]);
      const result = await service.findAll({ page: 1, pageSize: 10, priceMax: 0 } as any);
      expect(result.items).toHaveLength(1);
    });

    it('paginates the filtered/sorted result in memory', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('a', 100),
        fakeProduct('b', 100),
        fakeProduct('c', 100),
      ]);
      const result = await service.findAll({ page: 2, pageSize: 2 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('always scopes the query to PUBLISHED, non-deleted products', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, pageSize: 10 } as any);
      expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({
        status: ProductStatus.PUBLISHED,
        deletedAt: null,
      });
    });
  });

  describe('findBySlug', () => {
    it('throws NotFoundException when no published product matches the slug', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the product when found, with media URLs resolved', async () => {
      const product = fakeProduct('p1', 1000);
      prisma.product.findFirst.mockResolvedValue(product);
      expect(await service.findBySlug('p1')).toEqual({ ...product, media: [] });
    });
  });

  describe('adminFindOne', () => {
    it('throws NotFoundException for a nonexistent product id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.adminFindOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the product (including drafts) when found', async () => {
      const product = fakeProduct('p1', 1000);
      prisma.product.findUnique.mockResolvedValue(product);
      expect(await service.adminFindOne('p1')).toEqual({ ...product, media: [] });
    });
  });

  describe('adminCreate / adminUpdate / adminDelete', () => {
    it('adminCreate always sets status DRAFT, even though the caller cannot specify a status', async () => {
      prisma.product.create.mockResolvedValue(fakeProduct('p1', 100));
      await service.adminCreate({ name: 'x', slug: 'x', categoryId: 'c1', description: 'd', variants: [] } as any);
      expect(prisma.product.create.mock.calls[0][0].data.status).toBe(ProductStatus.DRAFT);
    });

    it('adminCreate emits product.upserted', async () => {
      prisma.product.create.mockResolvedValue(fakeProduct('p1', 100));
      await service.adminCreate({ name: 'x', slug: 'x', categoryId: 'c1', description: 'd', variants: [] } as any);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('adminUpdate throws NotFoundException for a nonexistent product before attempting the update', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdate('missing', { status: 'PUBLISHED' } as any)).rejects.toThrow(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('adminUpdate emits product.upserted on success', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.product.update.mockResolvedValue(fakeProduct('p1', 100));
      await service.adminUpdate('p1', { status: 'PUBLISHED' } as any);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    // variantPriceUpdates is the only way an admin can change pricing —
    // UpdateProductDto exposes no other variant fields.
    it('adminUpdate applies variant price updates inside the transaction', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.product.update.mockResolvedValue(fakeProduct('p1', 250));
      prisma.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });

      await service.adminUpdate('p1', {
        variantPriceUpdates: [{ variantId: 'v1', basePriceMinorUnits: 250 }],
      } as any);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { basePriceMinorUnits: 250 },
      });
    });

    // Guards against repricing another product's variant by passing its id.
    it('adminUpdate rejects a variant that belongs to a different product', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productVariant.findUnique.mockResolvedValue({ id: 'v9', productId: 'other' });

      await expect(
        service.adminUpdate('p1', {
          variantPriceUpdates: [{ variantId: 'v9', basePriceMinorUnits: 1 }],
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });

    it('adminUpdate rejects an unknown variant id', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        service.adminUpdate('p1', {
          variantPriceUpdates: [{ variantId: 'nope', basePriceMinorUnits: 1 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('adminDelete soft-deletes (sets deletedAt + ARCHIVED) and emits product.deleted', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.product.update.mockResolvedValue({});
      await service.adminDelete('p1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { deletedAt: expect.any(Date), status: ProductStatus.ARCHIVED },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('product.deleted', { productId: 'p1' });
    });
  });

  describe('adminFindAll', () => {
    it('excludes soft-deleted products and returns a paginated envelope', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('p1', 100)]);
      prisma.product.count.mockResolvedValue(1);
      const result = await service.adminFindAll({ page: 1, pageSize: 10 });
      expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
      expect(result).toEqual({ items: [fakeProduct('p1', 100)], page: 1, pageSize: 10, total: 1 });
    });
  });

  describe('addMedia', () => {
    it('throws NotFoundException for a nonexistent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.addMedia('missing', { buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png' }),
      ).rejects.toThrow(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects an unsupported MIME type before ever calling the storage port', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      await expect(
        service.addMedia('p1', { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'a.pdf' }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a file over the size limit before ever calling the storage port', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      const big = Buffer.alloc(9 * 1024 * 1024);
      await expect(
        service.addMedia('p1', { buffer: big, mimetype: 'image/png', originalname: 'a.png' }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uploads via the storage port and persists a ProductMedia row with the next sortOrder', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productMedia.count.mockResolvedValue(2);

      await service.addMedia('p1', { buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png' });

      expect(storage.upload).toHaveBeenCalledWith({
        buffer: Buffer.from('x'),
        mimeType: 'image/png',
        originalFilename: 'a.png',
        folder: 'products',
      });
      expect(prisma.productMedia.create).toHaveBeenCalledWith({
        data: { productId: 'p1', storageRef: 'local:products/new.jpg', sortOrder: 2 },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });
  });

  describe('removeMedia', () => {
    it('throws NotFoundException when the media does not belong to this product', async () => {
      prisma.productMedia.findUnique.mockResolvedValue({ id: 'm1', productId: 'other-product' });
      await expect(service.removeMedia('p1', 'm1')).rejects.toThrow(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes from storage and the database', async () => {
      prisma.productMedia.findUnique.mockResolvedValue({ id: 'm1', productId: 'p1', storageRef: 'local:products/a.jpg' });
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));

      await service.removeMedia('p1', 'm1');

      expect(storage.delete).toHaveBeenCalledWith('local:products/a.jpg');
      expect(prisma.productMedia.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });

  describe('reorderMedia', () => {
    it('rejects a mediaIds list that does not exactly match the product’s current media', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100, { media: [{ id: 'm1' }, { id: 'm2' }] }));
      await expect(service.reorderMedia('p1', ['m1'])).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates sortOrder to match the given order', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100, { media: [{ id: 'm1' }, { id: 'm2' }] }));

      await service.reorderMedia('p1', ['m2', 'm1']);

      expect(prisma.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { sortOrder: 0 } });
      expect(prisma.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { sortOrder: 1 } });
    });
  });

  describe('listCategories', () => {
    it('excludes soft-deleted categories', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await service.listCategories();
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });
  });

  describe('createCategory', () => {
    it('derives a slug from the name when none is supplied', async () => {
      prisma.category.create.mockResolvedValue({ id: 'c1' });
      await service.createCategory({ name: 'Necklaces & Pendants' } as any);
      expect(prisma.category.create.mock.calls[0][0].data).toMatchObject({
        name: 'Necklaces & Pendants',
        slug: 'necklaces-pendants',
        parentId: null,
        sortOrder: 0,
      });
    });

    it('slugifies a caller-supplied slug rather than trusting it verbatim', async () => {
      prisma.category.create.mockResolvedValue({ id: 'c1' });
      await service.createCategory({ name: 'X', slug: 'My Custom SLUG!' } as any);
      expect(prisma.category.create.mock.calls[0][0].data.slug).toBe('my-custom-slug');
    });

    it('rejects a name with no alphanumeric characters (empty slug)', async () => {
      await expect(service.createCategory({ name: '—' } as any)).rejects.toThrow(BadRequestException);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('validates the parent exists before creating', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.createCategory({ name: 'Chokers', parentId: 'nope' } as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('connects a valid parent and honours an explicit sortOrder', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.category.create.mockResolvedValue({ id: 'c2' });
      await service.createCategory({ name: 'Chokers', parentId: 'p1', sortOrder: 3 } as any);
      expect(prisma.category.create.mock.calls[0][0].data).toMatchObject({ parentId: 'p1', sortOrder: 3 });
    });

    it('maps a unique-constraint violation to a friendly BadRequest', async () => {
      prisma.category.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.createCategory({ name: 'Rings' } as any)).rejects.toThrow(/already exists/);
    });

    it('rethrows a non-P2002 database error unchanged', async () => {
      prisma.category.create.mockRejectedValue(new Error('connection lost'));
      await expect(service.createCategory({ name: 'Rings' } as any)).rejects.toThrow('connection lost');
    });
  });

  describe('updateCategory', () => {
    it('throws NotFound for a missing category before any write', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.updateCategory('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('rejects making a category its own parent', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      await expect(service.updateCategory('c1', { parentId: 'c1' })).rejects.toThrow(/own parent/);
    });

    it('rejects moving a category under one of its own descendants (cycle)', async () => {
      // c1 exists; requested parent c2 exists; walking up from c2 reaches c1.
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.findUnique.mockResolvedValueOnce({ parentId: 'c1' }); // c2's parent is c1
      await expect(service.updateCategory('c1', { parentId: 'c2' })).rejects.toThrow(/descendant/);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('applies name, slugified slug, sortOrder and a parent connect', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.findUnique.mockResolvedValue({ parentId: null }); // parent p2 is top-level, no cycle
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.updateCategory('c1', { name: 'New', slug: 'New Slug', sortOrder: 5, parentId: 'p2' });
      expect(prisma.category.update.mock.calls[0][0].data).toMatchObject({
        name: 'New',
        slug: 'new-slug',
        sortOrder: 5,
        parent: { connect: { id: 'p2' } },
      });
    });

    it('disconnects the parent when parentId is explicitly null', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.updateCategory('c1', { parentId: null });
      expect(prisma.category.update.mock.calls[0][0].data).toEqual({ parent: { disconnect: true } });
    });

    it('rejects a slug that slugifies to empty', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      await expect(service.updateCategory('c1', { slug: '!!!' })).rejects.toThrow(BadRequestException);
    });

    it('maps a duplicate slug to a friendly BadRequest', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.updateCategory('c1', { slug: 'rings' })).rejects.toThrow(/already exists/);
    });
  });

  describe('deleteCategory', () => {
    it('throws NotFound for a missing category', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.deleteCategory('missing')).rejects.toThrow(NotFoundException);
    });

    it('refuses to delete a category that still has subcategories', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.count.mockResolvedValue(2); // children
      prisma.product.count.mockResolvedValue(0);
      await expect(service.deleteCategory('c1')).rejects.toThrow(/subcategories/);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('refuses to delete a category that still has products', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(7);
      await expect(service.deleteCategory('c1')).rejects.toThrow(/7 product/);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('soft-deletes an empty category by stamping deletedAt', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.deleteCategory('c1');
      const arg = prisma.category.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      expect(arg.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
