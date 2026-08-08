import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, SizeScheme } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { assertVariantSizes, resolveSchemeFromChain } from './size-validation';
import { assertPublishable } from './publish-validation';
import { SizesService } from '../sizes/sizes.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';
import { MAX_IMAGE_BYTES, isAllowedImageMimeType } from '../../common/media/image-upload.constraints';
import {
  NO_RATING,
  RatingAggregate,
  deriveRating,
  deriveRatings,
  ratingsDiffer,
  writeRating,
} from './rating-aggregate';

/** One product whose stored aggregate disagreed with its approved reviews. */
export interface RatingDrift {
  productId: string;
  name: string;
  stored: RatingAggregate;
  correct: RatingAggregate;
}

export interface RatingReconciliation {
  scanned: number;
  drifted: number;
  /** Zero on a dry run — nothing was written. */
  corrected: number;
  dryRun: boolean;
  products: RatingDrift[];
}

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
type ProductResponse = Omit<ProductWithRelations, 'media'> & {
  media: ProductMediaResponse[];
  /**
   * Present only on a response that just published something
   * (FEAT-PUBLISH-COMPLETENESS §4). Not persisted: a stored copy would be a
   * second source of truth for something the product rows already determine,
   * and would go stale the moment a price or an image changed.
   */
  publishWarnings?: string[];
};

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
    private readonly sizes: SizesService,
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
    const { page, pageSize, category, metal, size, q, priceMin, priceMax, sort } = query;

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
      ...(matchingIds && { id: { in: matchingIds } }),
      // Metal and size are separate `some` clauses under AND, not two keys on
      // the same object — `{...(a && {variants:X}), ...(b && {variants:Y})}`
      // would silently drop X, because the second spread overwrites the key.
      //
      // Two clauses is also the semantically correct reading: one combined
      // `some: { metal, size }` requires a *single* variant that is both silver
      // and size 16, which is what "silver, size 16" means to a shopper. The
      // AND-of-somes form below matches a product having a silver variant and a
      // size-16 variant separately, which is what a facet filter conventionally
      // means. We take the stricter single-variant reading.
      ...(metal || size
        ? { variants: { some: { ...(metal && { metal }), ...(size && { size }) } } }
        : {}),
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

  /**
   * Resolves the sizing scheme for a category by walking its ancestor chain,
   * then returns the seeded values for it. Depth is bounded at 5 — the
   * client's taxonomy is two levels and a cycle here would hang a request.
   * FEAT-SIZE-TAXONOMY.
   */
  private async sizeContextFor(categoryId: string): Promise<{
    scheme: SizeScheme | null;
    validValues: Set<string>;
  }> {
    const chain: Array<{ sizeScheme: SizeScheme | null }> = [];
    let currentId: string | null = categoryId;

    for (let depth = 0; currentId && depth < 5; depth += 1) {
      const node: { sizeScheme: SizeScheme | null; parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { sizeScheme: true, parentId: true },
        });
      if (!node) break;
      chain.push({ sizeScheme: node.sizeScheme });
      currentId = node.parentId;
    }

    const scheme = resolveSchemeFromChain(chain);
    const validValues = scheme ? await this.sizes.valuesFor(scheme) : new Set<string>();
    return { scheme, validValues };
  }

  async adminCreate(dto: CreateProductDto): Promise<ProductResponse> {
    const { scheme, validValues } = await this.sizeContextFor(dto.categoryId);
    assertVariantSizes(dto.variants, scheme, validValues);

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
    const existing = await this.findProductOrThrow(id);
    const { variantPriceUpdates, ...productFields } = dto;

    // FEAT-PUBLISH-COMPLETENESS. The gate runs on the *transition* into
    // PUBLISHED — from DRAFT or from ARCHIVED, since a product may have been
    // archived precisely because it was wrong. Editing an already-published
    // product does not re-run it; that would refuse changes to products
    // published before this gate existed (§7.2).
    const publishing =
      dto.status === ProductStatus.PUBLISHED && existing.status !== ProductStatus.PUBLISHED;

    let publishWarnings: string[] = [];
    if (publishing) {
      // Prices in this same request are what will be persisted, so validate
      // against the post-update values rather than the stored ones — otherwise
      // "set the price and publish" in one call is refused for a price it is
      // about to have.
      const pending = new Map(
        (variantPriceUpdates ?? []).map((u) => [u.variantId, u.basePriceMinorUnits]),
      );
      const { scheme } = await this.sizeContextFor(productFields.categoryId ?? existing.categoryId);

      publishWarnings = assertPublishable({
        name: productFields.name ?? existing.name,
        description: productFields.description ?? existing.description,
        mediaCount: existing.media.length,
        sizeScheme: scheme,
        variants: existing.variants.map((variant) => ({
          sku: variant.sku,
          basePriceMinorUnits: pending.get(variant.id) ?? variant.basePriceMinorUnits,
          size: variant.size,
        })),
      });
    }

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
    // Warnings ride on the success response rather than inventing a second
    // channel, and are not persisted — recomputing is cheap and a stored copy
    // would go stale the moment a price or an image changed
    // (`STD-DATABASE` r9).
    return { ...this.withResolvedMedia(product), ...(publishing && { publishWarnings }) };
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

  /**
   * `/collections/[slug]` resolves a Collection first and falls back to a
   * Category, so the two share one URL space. A category taking a slug a
   * collection already holds would be permanently shadowed — its page would
   * render the collection instead, with nothing in the logs to say why.
   *
   * The mirror of this lives in `CollectionsService.assertSlugIsFree`.
   * Guarding one side only leaves the same collision reachable from the
   * other, which is why this check exists in a file about products.
   */
  private async assertSlugNotTakenByCollection(slug: string): Promise<void> {
    const collection = await this.prisma.collection.findUnique({ where: { slug } });
    if (collection) {
      throw new BadRequestException(
        `The collection "${collection.name}" already uses the slug "${slug}". A category sharing it would be hidden behind that collection.`,
      );
    }
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = (dto.slug ? ProductsService.slugify(dto.slug) : ProductsService.slugify(dto.name)) || '';
    if (!slug) {
      throw new BadRequestException('Category name must contain at least one alphanumeric character for its slug.');
    }
    await this.assertSlugNotTakenByCollection(slug);
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
      await this.assertSlugNotTakenByCollection(slug);
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

  // Shared with the controller's ParseFilePipe and the admin/uploads route
  // via common/media/image-upload.constraints — one definition of the limit,
  // still checked independently at each layer.

  async addMedia(productId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<ProductResponse> {
    await this.findProductOrThrow(productId);

    // Belt-and-braces alongside the controller's ParseFilePipe validators —
    // SECURITY.md §6 requires server-side validation before a file is ever
    // handed to the Storage port, and a service method callable from
    // anywhere shouldn't rely on one specific controller route being the
    // only caller that got the pipe configuration right.
    if (!isAllowedImageMimeType(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.buffer.byteLength > MAX_IMAGE_BYTES) {
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

  // ────────────────────────────────────────────────────────────────────────
  // RATING AGGREGATES — ADR-0008 / FEAT-RATING-OWNERSHIP
  //
  // Catalog owns `avgRating` and `ratingCount`: the column, the value, the
  // write and the `product.upserted` emission. Reviews used to write this row
  // and emit this event directly, which left the aggregate with no single
  // owner — no context could guarantee it was right (KC-142, KC-152). Since it
  // feeds search ranking's popularity signal, the failure mode was not a
  // visibly wrong number but subtly wrong result ordering.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Runs `work` and the rating recompute for `productId` in **one
   * transaction**, then emits `product.upserted` **after it commits**.
   *
   * The callback shape exists so a caller in another context can make its own
   * write atomic with the recompute without Catalog handing out its table: a
   * review approved whose rating did not move is exactly the desync ADR-0008
   * exists to prevent, so the two must not be able to come apart.
   *
   * Emission is after commit rather than inside, because Search re-reads the
   * product from the database when it handles the event — inside the
   * transaction it would index the pre-commit value and, on a rollback,
   * announce a write that never happened.
   */
  async withRatingRecompute<T>(
    productId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const result = await this.prisma.$transaction(async (tx) => {
      const outcome = await work(tx);
      const derived = await deriveRating(tx, productId);
      await writeRating(tx, productId, derived);
      return outcome;
    });

    this.eventBus.emit('product.upserted', { productId });
    return result;
  }

  /** Recomputes one product's aggregate on its own. Same ownership rules. */
  async recomputeRating(productId: string): Promise<RatingAggregate> {
    return this.withRatingRecompute(productId, async (tx) => deriveRating(tx, productId));
  }

  /**
   * Reconciles every product's aggregate against its approved reviews.
   *
   * ADR-0008 consequence 3: *"If only one half of this ADR is implemented,
   * implement this half."* Ownership makes the value correct by construction;
   * this makes it recoverable when construction is bypassed — and this system
   * has live bypasses: the demo seed, CSV bulk import, and manual SQL
   * correction as a documented operational practice (RUNBOOK §11a).
   *
   * Soft-deleted products are included deliberately (§7.4). A product can be
   * restored, and restoring one with a stale rating would reintroduce exactly
   * the drift this removes.
   *
   * @param dryRun report drift without writing. The report is the point: an
   *   operator's real question is *how wrong was it*, which a bare "done"
   *   cannot answer.
   */
  async reconcileRatings({ dryRun = false }: { dryRun?: boolean } = {}): Promise<RatingReconciliation> {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, avgRating: true, ratingCount: true },
    });
    const derivedByProduct = await deriveRatings(this.prisma);

    const drifted: RatingDrift[] = [];
    for (const product of products) {
      const stored: RatingAggregate = {
        avgRating: Number(product.avgRating),
        ratingCount: product.ratingCount,
      };
      // Absent from the map means no approved reviews — the zero state, not
      // "leave it alone" (§7.2). Reading that absence as no-op is the bug that
      // would leave a rating standing after its last review was rejected.
      const derived = derivedByProduct.get(product.id) ?? NO_RATING;

      if (ratingsDiffer(stored, derived)) {
        drifted.push({ productId: product.id, name: product.name, stored, correct: derived });
      }
    }

    if (!dryRun) {
      for (const entry of drifted) {
        await writeRating(this.prisma, entry.productId, entry.correct);
        // Only for products actually corrected. Emitting per product scanned
        // would reindex the entire catalogue to fix a handful of rows.
        this.eventBus.emit('product.upserted', { productId: entry.productId });
      }
    }

    return {
      scanned: products.length,
      drifted: drifted.length,
      corrected: dryRun ? 0 : drifted.length,
      dryRun,
      products: drifted,
    };
  }
}
