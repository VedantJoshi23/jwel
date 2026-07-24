import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';

const productInclude = {
  category: true,
  variants: true,
  media: { orderBy: { sortOrder: 'asc' as const } },
};

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ProductMediaRow = ProductWithRelations['media'][number];
// `storageRef` stays on the response too (nothing secret about it, it's just
// not directly loadable) — `url` is what every read path actually needs;
// see StorageProviderPort's own comment on why this resolution can't happen
// on the frontend.
type ProductMediaResponse = ProductMediaRow & { url: string };
type ProductResponse = Omit<ProductWithRelations, 'media'> & { media: ProductMediaResponse[] };

function minVariantPrice(product: ProductWithRelations): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
  ) {}

  private withResolvedMedia(product: ProductWithRelations): ProductResponse {
    return {
      ...product,
      media: product.media.map((m) => ({ ...m, url: this.storage.resolveUrl(m.storageRef) })),
    };
  }

  private withResolvedMediaMany(products: ProductWithRelations[]): ProductResponse[] {
    return products.map((p) => this.withResolvedMedia(p));
  }

  /**
   * Postgres serves catalog browsing directly at MVP scale. Price filtering/
   * sorting happens per-product-min-variant-price, which Prisma can't express
   * as a single SQL ORDER BY across a 1:many relation — so the matching set is
   * fetched once and sorted/paginated in memory. ARCHITECTURE.md already
   * designates Elasticsearch as the long-term primary search/browse path;
   * this is the documented interim approach, not the final scaling story.
   */
  async findAll(query: QueryProductsDto): Promise<PaginatedResult<ProductResponse>> {
    const { page, pageSize, category, metal, q, priceMin, priceMax, sort } = query;

    // `q` matching used to be a single literal `contains` on name/description —
    // strict substring matching, no typo tolerance, no per-word matching (a
    // two-word query only matched if both words appeared adjacently, in order).
    // `products.search_vector` (generated tsvector column + GIN index) and the
    // `pg_trgm` extension already exist for exactly this case (see the
    // constraints_and_search migration) but were never wired up here — this is
    // the Postgres side of the "elastic" fallback ARCHITECTURE.md always
    // specified, not a new capability. `websearch_to_tsquery` gives per-word/
    // any-order matching; `word_similarity` catches typos on an individual word
    // within a longer name that `websearch_to_tsquery` can't (e.g. "neckless"
    // still finding "Temple Coin Necklace") — plain `similarity()` compares the
    // whole strings and was tried first, but a short typo'd word against a long
    // multi-word product name scores too low against it (0.2, under any
    // reasonable threshold) even though the single-word match is a good one.
    const matchingIds = q
      ? (
          await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM products
            WHERE status = 'PUBLISHED' AND deleted_at IS NULL
              AND (
                search_vector @@ websearch_to_tsquery('english', ${q})
                OR word_similarity(${q}, name) > 0.4
              )
          `
        ).map((row) => row.id)
      : undefined;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      deletedAt: null,
      ...(category && { category: { slug: category } }),
      ...(metal && { variants: { some: { metal } } }),
      ...(matchingIds && { id: { in: matchingIds } }),
    };

    const matches = await this.prisma.product.findMany({ where, include: productInclude });

    let filtered = matches;
    if (priceMin !== undefined) {
      filtered = filtered.filter((p) => minVariantPrice(p) >= priceMin);
    }
    if (priceMax !== undefined) {
      filtered = filtered.filter((p) => minVariantPrice(p) <= priceMax);
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case ProductSort.PRICE_ASC:
          return minVariantPrice(a) - minVariantPrice(b);
        case ProductSort.PRICE_DESC:
          return minVariantPrice(b) - minVariantPrice(a);
        case ProductSort.POPULARITY:
          return b.ratingCount - a.ratingCount;
        case ProductSort.NEWEST:
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items: this.withResolvedMediaMany(items), page, pageSize, total };
  }

  async findBySlug(slug: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.PUBLISHED, deletedAt: null },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.withResolvedMedia(product);
  }

  // The Admin Portal's Products module (Milestone 10) needs to see drafts
  // and archived products too — `findAll` above is PUBLISHED-only by design
  // (it's the public catalog browse path). No filtering/sorting beyond
  // pagination, unlike `findAll` — an admin catalog list is a much smaller,
  // more occasional read than the storefront's, so the same in-memory
  // price-sort complexity isn't worth duplicating here.
  async adminFindAll(query: PaginationQueryDto): Promise<PaginatedResult<ProductResponse>> {
    const { page, pageSize } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { deletedAt: null },
        include: productInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { deletedAt: null } }),
    ]);
    return { items: this.withResolvedMediaMany(items), page, pageSize, total };
  }

  async adminFindOne(id: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.withResolvedMedia(product);
  }

  // Raw variant used internally by the media-management methods below, which
  // need the plain Prisma row (to re-fetch/mutate `media`), not the
  // URL-resolved response shape.
  private async findProductOrThrow(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async adminCreate(dto: CreateProductDto): Promise<ProductResponse> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        categoryId: dto.categoryId,
        description: dto.description,
        certificationType: dto.certificationType,
        certificationDocRef: dto.certificationDocRef,
        status: ProductStatus.DRAFT,
        variants: {
          create: dto.variants.map((variant) => ({
            sku: variant.sku,
            metal: variant.metal,
            purity: variant.purity,
            size: variant.size,
            weightGrams: variant.weightGrams,
            basePriceMinorUnits: variant.basePriceMinorUnits,
            inventory: { create: { quantityOnHand: 0, quantityReserved: 0 } },
          })),
        },
      },
      include: productInclude,
    });
    this.eventBus.emit('product.upserted', { productId: product.id });
    return this.withResolvedMedia(product);
  }

  async adminUpdate(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    await this.findProductOrThrow(id);
    const { variantPriceUpdates, ...productFields } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      for (const { variantId, basePriceMinorUnits } of variantPriceUpdates ?? []) {
        const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!variant || variant.productId !== id) {
          throw new NotFoundException(`Variant ${variantId} not found on this product`);
        }
        await tx.productVariant.update({ where: { id: variantId }, data: { basePriceMinorUnits } });
      }
      return tx.product.update({ where: { id }, data: productFields, include: productInclude });
    });

    this.eventBus.emit('product.upserted', { productId: product.id });
    return this.withResolvedMedia(product);
  }

  async listCategories() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  // --- Category management ---------------------------------------------
  // Lives here rather than in a standalone module because the admin product
  // form is the only consumer and `listCategories` already does — keeps the
  // one small surface together instead of spinning up a module for four
  // methods. Slugs are unique and URL-facing, so a rename keeps the old slug
  // unless the caller sends a new one explicitly.

  private static slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = (dto.slug ? ProductsService.slugify(dto.slug) : ProductsService.slugify(dto.name)) || '';
    if (!slug) {
      throw new BadRequestException('Category name must contain at least one alphanumeric character for its slug.');
    }
    if (dto.parentId) {
      await this.getLiveCategoryOrThrow(dto.parentId);
    }
    try {
      return await this.prisma.category.create({
        data: { name: dto.name, slug, parentId: dto.parentId ?? null, sortOrder: dto.sortOrder ?? 0 },
      });
    } catch (error) {
      throw this.mapCategoryWriteError(error, slug);
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.getLiveCategoryOrThrow(id);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
      await this.getLiveCategoryOrThrow(dto.parentId);
      if (await this.isDescendant(dto.parentId, id)) {
        throw new BadRequestException('Cannot move a category under one of its own descendants.');
      }
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) {
      const slug = ProductsService.slugify(dto.slug);
      if (!slug) throw new BadRequestException('Slug must contain at least one alphanumeric character.');
      data.slug = slug;
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId === null ? { disconnect: true } : { connect: { id: dto.parentId } };
    }

    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      throw this.mapCategoryWriteError(error, dto.slug);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    await this.getLiveCategoryOrThrow(id);

    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
    ]);
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete a category that still has subcategories. Move or delete them first.');
    }
    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete a category with ${productCount} product(s). Reassign or archive them first.`,
      );
    }

    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async getLiveCategoryOrThrow(id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  // Walk up from `startId` to check whether `ancestorId` sits above it — the
  // guard that stops updateCategory from creating a parent/child cycle.
  private async isDescendant(startId: string, ancestorId: string): Promise<boolean> {
    let current: string | null = startId;
    // Bounded by the number of categories; a corrupt cycle already in the data
    // would otherwise loop forever, so cap the walk defensively.
    for (let hops = 0; current && hops < 1000; hops++) {
      if (current === ancestorId) return true;
      const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = parent?.parentId ?? null;
    }
    return false;
  }

  private mapCategoryWriteError(error: unknown, slug?: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new BadRequestException(`A category with slug "${slug}" already exists.`);
    }
    return error as Error;
  }

  async adminDelete(id: string): Promise<void> {
    await this.findProductOrThrow(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });
    this.eventBus.emit('product.deleted', { productId: id });
  }

  // --- Media management -------------------------------------------------

  private static readonly ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static readonly MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB

  async addMedia(productId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<ProductResponse> {
    await this.findProductOrThrow(productId);

    // Belt-and-braces alongside the controller's ParseFilePipe validators —
    // SECURITY.md §6 requires server-side validation before a file is ever
    // handed to the Storage port, and a service method callable from
    // anywhere shouldn't rely on one specific controller route being the
    // only caller that got the pipe configuration right.
    if (!ProductsService.ALLOWED_MEDIA_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.buffer.byteLength > ProductsService.MAX_MEDIA_BYTES) {
      throw new BadRequestException('File exceeds the 8 MB upload limit');
    }

    const existingCount = await this.prisma.productMedia.count({ where: { productId } });
    const { storageRef } = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      folder: 'products',
    });

    await this.prisma.productMedia.create({
      data: { productId, storageRef, sortOrder: existingCount },
    });

    const product = await this.findProductOrThrow(productId);
    this.eventBus.emit('product.upserted', { productId });
    return this.withResolvedMedia(product);
  }

  async removeMedia(productId: string, mediaId: string): Promise<ProductResponse> {
    const media = await this.prisma.productMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.productId !== productId) {
      throw new NotFoundException('Media not found on this product');
    }

    await this.storage.delete(media.storageRef);
    await this.prisma.productMedia.delete({ where: { id: mediaId } });

    const product = await this.findProductOrThrow(productId);
    this.eventBus.emit('product.upserted', { productId });
    return this.withResolvedMedia(product);
  }

  async reorderMedia(productId: string, mediaIds: string[]): Promise<ProductResponse> {
    const product = await this.findProductOrThrow(productId);
    const existingIds = new Set(product.media.map((m) => m.id));
    const sameSet = mediaIds.length === existingIds.size && mediaIds.every((id) => existingIds.has(id));
    if (!sameSet) {
      throw new BadRequestException('mediaIds must be exactly the product’s current media items, reordered');
    }

    await this.prisma.$transaction(
      mediaIds.map((id, index) => this.prisma.productMedia.update({ where: { id }, data: { sortOrder: index } })),
    );

    const updated = await this.findProductOrThrow(productId);
    return this.withResolvedMedia(updated);
  }
}
