import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MediaType, Prisma, ProductStatus } from '@prisma/client';
import { SizesService } from '../sizes/sizes.service';
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
  collection: { findUnique: jest.Mock };
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
  let sizes: { valuesFor: jest.Mock };
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
      // Category writes check this to keep a category from taking a slug a
      // collection already holds — the two share /collections/[slug].
      collection: { findUnique: jest.fn().mockResolvedValue(null) },
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
    // FEAT-SIZE-TAXONOMY: the default stub is an unsized category, so every
    // pre-existing test keeps its original meaning — variants without sizes
    // stay valid. Tests that exercise sizing override `category.findUnique`
    // and `sizes.valuesFor` explicitly.
    sizes = { valuesFor: jest.fn().mockResolvedValue(new Set<string>()) };
    prisma.category = {
      ...(prisma.category ?? {}),
      findUnique: jest.fn().mockResolvedValue({ sizeScheme: null, parentId: null }),
    };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBusService,
      storage as unknown as StorageProviderPort,
      sizes as unknown as SizesService,
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
      // A rename, not a publish. This test is about the event, and since
      // FEAT-PUBLISH-COMPLETENESS a publish transition runs a completeness gate
      // that this minimal fixture would fail — entangling the two would make
      // an event assertion depend on catalogue-data rules. The gate has its own
      // tests below.
      await service.adminUpdate('p1', { name: 'Renamed' } as any);
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
        data: { productId: 'p1', storageRef: 'local:products/new.jpg', type: MediaType.IMAGE, sortOrder: 2 },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('accepts an allowed video mime type and persists it with type VIDEO', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productMedia.count.mockResolvedValue(1); // an image already exists

      await service.addMedia('p1', { buffer: Buffer.from('x'), mimetype: 'video/mp4', originalname: 'a.mp4' });

      expect(prisma.productMedia.create).toHaveBeenCalledWith({
        data: { productId: 'p1', storageRef: 'local:products/new.jpg', type: MediaType.VIDEO, sortOrder: 1 },
      });
    });

    it('rejects a video over the 40 MB video size limit before ever calling the storage port', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productMedia.count.mockResolvedValue(1);
      const big = Buffer.alloc(41 * 1024 * 1024);
      await expect(
        service.addMedia('p1', { buffer: big, mimetype: 'video/mp4', originalname: 'a.mp4' }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a video as the very first media item on a product — the thumbnail must be an image', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeProduct('p1', 100));
      prisma.productMedia.count.mockResolvedValue(0);

      await expect(
        service.addMedia('p1', { buffer: Buffer.from('x'), mimetype: 'video/mp4', originalname: 'a.mp4' }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('removeMedia', () => {
    it('throws NotFoundException when the media does not belong to this product', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, { media: [{ id: 'm2', type: MediaType.IMAGE, storageRef: 'local:products/b.jpg' }] }),
      );
      await expect(service.removeMedia('p1', 'm1')).rejects.toThrow(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes from storage and the database, resequencing what remains', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, {
          media: [
            { id: 'm1', type: MediaType.IMAGE, storageRef: 'local:products/a.jpg' },
            { id: 'm2', type: MediaType.IMAGE, storageRef: 'local:products/b.jpg' },
          ],
        }),
      );

      await service.removeMedia('p1', 'm1');

      expect(storage.delete).toHaveBeenCalledWith('local:products/a.jpg');
      expect(prisma.productMedia.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(prisma.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { sortOrder: 0 } });
    });

    it('rejects removing the last image while a video remains on the product', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, {
          media: [
            { id: 'm1', type: MediaType.IMAGE, storageRef: 'local:products/a.jpg' },
            { id: 'm2', type: MediaType.VIDEO, storageRef: 'local:products/clip.mp4' },
          ],
        }),
      );

      await expect(service.removeMedia('p1', 'm1')).rejects.toThrow(ConflictException);
      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows removing a video even when it is the only other item', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, {
          media: [
            { id: 'm1', type: MediaType.IMAGE, storageRef: 'local:products/a.jpg' },
            { id: 'm2', type: MediaType.VIDEO, storageRef: 'local:products/clip.mp4' },
          ],
        }),
      );

      await service.removeMedia('p1', 'm2');

      expect(storage.delete).toHaveBeenCalledWith('local:products/clip.mp4');
    });
  });

  describe('reorderMedia', () => {
    it('rejects a mediaIds list that does not exactly match the product’s current media', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, { media: [{ id: 'm1', type: MediaType.IMAGE }, { id: 'm2', type: MediaType.IMAGE }] }),
      );
      await expect(service.reorderMedia('p1', ['m1'])).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates sortOrder to match the given order', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, { media: [{ id: 'm1', type: MediaType.IMAGE }, { id: 'm2', type: MediaType.IMAGE }] }),
      );

      await service.reorderMedia('p1', ['m2', 'm1']);

      expect(prisma.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { sortOrder: 0 } });
      expect(prisma.productMedia.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { sortOrder: 1 } });
    });

    it('rejects moving a video to index 0 — a video can never be the thumbnail', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeProduct('p1', 100, {
          media: [
            { id: 'm1', type: MediaType.IMAGE },
            { id: 'm2', type: MediaType.VIDEO },
          ],
        }),
      );

      await expect(service.reorderMedia('p1', ['m2', 'm1'])).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

    // The mirror of CollectionsService's guard. /collections/[slug] resolves a
    // collection before falling back to a category, so a category taking a
    // collection's slug would be permanently shadowed by it.
    it('refuses a slug a collection already holds', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col1', name: 'Diwali Edit', slug: 'diwali-edit' });
      await expect(service.createCategory({ name: 'Diwali Edit' } as any)).rejects.toThrow(
        /collection "Diwali Edit"/,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
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

    it('sets sizeScheme — this is what makes the storefront size filter appear', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.updateCategory('c1', { sizeScheme: 'RING_INDIA' as any });
      expect(prisma.category.update.mock.calls[0][0].data).toEqual({ sizeScheme: 'RING_INDIA' });
    });

    it('reverts sizeScheme to "inherit from parent" when explicitly set to null', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.updateCategory('c1', { sizeScheme: null });
      expect(prisma.category.update.mock.calls[0][0].data).toEqual({ sizeScheme: null });
    });

    it('leaves sizeScheme untouched when the field is absent from the request', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.category.update.mockResolvedValue({ id: 'c1' });
      await service.updateCategory('c1', { name: 'New' });
      expect(prisma.category.update.mock.calls[0][0].data).not.toHaveProperty('sizeScheme');
    });

    // Renaming into the collision is the same defect as creating into it, and
    // is the easier one to hit — the category already exists and works.
    it('refuses renaming a category onto a slug a collection holds', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.collection.findUnique.mockResolvedValue({ id: 'col1', name: 'Diwali Edit', slug: 'diwali-edit' });
      await expect(service.updateCategory('c1', { slug: 'diwali-edit' })).rejects.toThrow(/collection "Diwali Edit"/);
      expect(prisma.category.update).not.toHaveBeenCalled();
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

describe('ProductsService — publish gate (FEAT-PUBLISH-COMPLETENESS)', () => {
  let prisma: any;
  let eventBus: any;
  let sizes: any;
  let service: ProductsService;

  const publishable = (over: any = {}) => ({
    id: 'p1',
    name: 'Dazzle Band Silver Ring',
    description: 'A studded band in 92.5 sterling silver.',
    status: 'DRAFT',
    categoryId: 'cat-1',
    media: [{ id: 'm1', storageRef: 'local:products/a.png', sortOrder: 0 }],
    variants: [{ id: 'v1', sku: 'SKU-1', basePriceMinorUnits: 249900, size: '16' }],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      product: { findUnique: jest.fn(), update: jest.fn() },
      productVariant: { findUnique: jest.fn(), update: jest.fn() },
      category: { findUnique: jest.fn().mockResolvedValue({ sizeScheme: 'RING_INDIA', parentId: null }) },
      $transaction: jest.fn((fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    };
    eventBus = { emit: jest.fn() };
    sizes = { valuesFor: jest.fn().mockResolvedValue(new Set(['16'])) };
    const storage = { resolveUrl: (r: string) => `https://cdn/${r}`, upload: jest.fn(), delete: jest.fn() };
    service = new ProductsService(prisma, eventBus, storage as any, sizes);
  });

  it('publishes a complete product and returns no warnings', async () => {
    prisma.product.findUnique.mockResolvedValue(publishable());
    prisma.product.update.mockResolvedValue(publishable({ status: 'PUBLISHED' }));

    const result: any = await service.adminUpdate('p1', { status: 'PUBLISHED' } as any);

    expect(result.publishWarnings).toEqual([]);
    expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
  });

  it('refuses to publish a generated placeholder draft', async () => {
    prisma.product.findUnique.mockResolvedValue(
      publishable({
        name: 'Untitled Draft 1041',
        description: 'Pending — placeholder draft created from an uploaded image. Edit before publishing.',
        variants: [{ id: 'v1', sku: 'DRAFT-x', basePriceMinorUnits: 0, size: null }],
      }),
    );

    await expect(service.adminUpdate('p1', { status: 'PUBLISHED' } as any)).rejects.toThrow(
      /Cannot publish/,
    );
  });

  it('does not emit product.upserted when a publish is refused', async () => {
    // Nothing changed, so nothing downstream should reindex or react.
    prisma.product.findUnique.mockResolvedValue(publishable({ name: 'Untitled Draft 3' }));

    await expect(service.adminUpdate('p1', { status: 'PUBLISHED' } as any)).rejects.toThrow();

    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('returns warnings when publishing a product with no images', async () => {
    prisma.product.findUnique.mockResolvedValue(publishable({ media: [] }));
    prisma.product.update.mockResolvedValue(publishable({ status: 'PUBLISHED', media: [] }));

    const result: any = await service.adminUpdate('p1', { status: 'PUBLISHED' } as any);

    expect(result.publishWarnings).toEqual([expect.stringContaining('no images')]);
    expect(eventBus.emit).toHaveBeenCalled();
  });

  it('runs the gate on ARCHIVED -> PUBLISHED too (§7.3)', async () => {
    // A product may have been archived precisely because it was wrong.
    prisma.product.findUnique.mockResolvedValue(
      publishable({ status: 'ARCHIVED', name: 'Untitled Draft 9' }),
    );

    await expect(service.adminUpdate('p1', { status: 'PUBLISHED' } as any)).rejects.toThrow();
  });

  it('does NOT re-run the gate when editing an already-published product (§7.2)', async () => {
    // Blocking here would refuse edits to products published before the gate
    // existed. That is a separate rule, recorded as a gap.
    prisma.product.findUnique.mockResolvedValue(
      publishable({ status: 'PUBLISHED', name: 'Untitled Draft 4' }),
    );
    prisma.product.update.mockResolvedValue(publishable({ status: 'PUBLISHED' }));

    const result: any = await service.adminUpdate('p1', { status: 'PUBLISHED' } as any);

    expect(result.publishWarnings).toBeUndefined();
  });

  it('validates against a price set in the SAME request', async () => {
    // "Set the price and publish" in one call must not be refused for a price
    // it is about to have.
    prisma.product.findUnique.mockResolvedValue(
      publishable({ variants: [{ id: 'v1', sku: 'SKU-1', basePriceMinorUnits: 0, size: '16' }] }),
    );
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'v1', productId: 'p1' });
    prisma.product.update.mockResolvedValue(publishable({ status: 'PUBLISHED' }));

    await expect(
      service.adminUpdate('p1', {
        status: 'PUBLISHED',
        variantPriceUpdates: [{ variantId: 'v1', basePriceMinorUnits: 249900 }],
      } as any),
    ).resolves.toBeDefined();
  });

  it('does not demand a size for an unsized category', async () => {
    prisma.category.findUnique.mockResolvedValue({ sizeScheme: null, parentId: null });
    prisma.product.findUnique.mockResolvedValue(
      publishable({ variants: [{ id: 'v1', sku: 'E-1', basePriceMinorUnits: 100, size: null }] }),
    );
    prisma.product.update.mockResolvedValue(publishable({ status: 'PUBLISHED' }));

    await expect(service.adminUpdate('p1', { status: 'PUBLISHED' } as any)).resolves.toBeDefined();
  });

  it('leaves a non-publish update untouched by the gate', async () => {
    prisma.product.findUnique.mockResolvedValue(publishable({ name: 'Untitled Draft 2' }));
    prisma.product.update.mockResolvedValue(publishable({ name: 'Renamed' }));

    const result: any = await service.adminUpdate('p1', { name: 'Renamed' } as any);

    expect(result.publishWarnings).toBeUndefined();
  });
});
