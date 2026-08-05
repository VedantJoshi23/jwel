import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCollectionDto } from './dto/upsert-collection.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';

/**
 * Slugs the storefront's `/collections/[slug]` route already answers itself,
 * before any database lookup happens: `all` lists the whole catalogue, and
 * `new-arrivals`/`bestsellers` are curated sorts. A Collection created under
 * one of these names would be unreachable — the page would never get far
 * enough to look it up — so the name is refused at write time rather than
 * saved into a row that silently never renders.
 */
const RESERVED_SLUGS = ['all', 'new-arrivals', 'bestsellers'];

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
  ) {}

  static slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // --- Public surface ----------------------------------------------------

  /**
   * Only collections that are inside their optional scheduling window, the
   * same rule the banner feed uses — a collection queued for Diwali should
   * not be reachable in September just because someone knows the URL.
   */
  private publicWindow(now: Date): Prisma.CollectionWhereInput {
    return {
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    };
  }

  async listPublic() {
    const collections = await this.prisma.collection.findMany({
      where: this.publicWindow(new Date()),
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    });
    return collections.map((collection) => this.withResolvedHero(collection));
  }

  /**
   * Returns `null` rather than throwing when the slug is not a live
   * collection. The storefront route falls back to its existing category
   * behaviour on null, so "not a collection" is an ordinary outcome here,
   * not an error — every category URL on the site produces it.
   */
  async findPublicBySlug(slug: string, pagination: PaginationQueryDto) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, ...this.publicWindow(new Date()) },
    });
    if (!collection) return null;

    const where: Prisma.CollectionProductWhereInput = {
      collectionId: collection.id,
      product: { status: ProductStatus.PUBLISHED, deletedAt: null },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.collectionProduct.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: {
          product: {
            include: { category: true, variants: true, media: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
      this.prisma.collectionProduct.count({ where }),
    ]);

    const products: PaginatedResult<unknown> = {
      items: rows.map((row) => ({
        ...row.product,
        media: row.product.media.map((m) => ({ ...m, url: this.storage.resolveUrl(m.storageRef) })),
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
    };

    return { ...this.withResolvedHero(collection), products };
  }

  // --- Admin surface -----------------------------------------------------

  async adminList() {
    const collections = await this.prisma.collection.findMany({
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return collections.map((collection) => this.withResolvedHero(collection));
  }

  async adminCreate(dto: UpsertCollectionDto) {
    const slug = this.resolveSlug(dto);
    await this.assertSlugIsFree(slug);

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        description: dto.description ?? null,
        heroImageRef: dto.heroImageRef ?? null,
        isFeatured: dto.isFeatured ?? false,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });

    if (dto.productIds) {
      await this.replaceProducts(collection.id, dto.productIds);
    }
    return this.withResolvedHero(collection);
  }

  async adminUpdate(id: string, dto: UpsertCollectionDto) {
    await this.findOrThrow(id);

    const data: Prisma.CollectionUpdateInput = {
      name: dto.name,
      type: dto.type,
      description: dto.description ?? null,
      heroImageRef: dto.heroImageRef ?? null,
      isFeatured: dto.isFeatured ?? false,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    };

    if (dto.slug !== undefined) {
      const slug = this.resolveSlug(dto);
      await this.assertSlugIsFree(slug, id);
      data.slug = slug;
    }

    const collection = await this.prisma.collection.update({ where: { id }, data });

    if (dto.productIds) {
      await this.replaceProducts(id, dto.productIds);
    }
    return this.withResolvedHero(collection);
  }

  async adminDelete(id: string): Promise<void> {
    await this.findOrThrow(id);
    // Hard delete, like Banner and unlike Product/Category: nothing
    // historical references a collection — no order, audit or payment row
    // points at one, so there is nothing a soft delete would preserve. The
    // CollectionProduct join rows go with it via onDelete: Cascade.
    await this.prisma.collection.delete({ where: { id } });
  }

  // --- Internals ---------------------------------------------------------

  private resolveSlug(dto: UpsertCollectionDto): string {
    const slug = CollectionsService.slugify(dto.slug ?? dto.name);
    if (!slug) {
      throw new BadRequestException('Collection name must contain at least one alphanumeric character for its slug.');
    }
    return slug;
  }

  /**
   * The guard that makes `/collections/[slug]` safe to point at two models.
   *
   * That route resolves a collection first and falls back to a category, so a
   * collection sharing a category's slug would silently shadow the category
   * page — a working URL quietly starts showing something else, with nothing
   * in the logs. Refusing the name at write time is the only point where the
   * operator can still be told about it.
   *
   * `ProductsService.createCategory`/`updateCategory` carry the mirror of
   * this check; a guard on one side only leaves the same collision reachable
   * from the other direction.
   */
  private async assertSlugIsFree(slug: string, excludeCollectionId?: string): Promise<void> {
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException(
        `"${slug}" is reserved by the storefront's own collection views and cannot be used as a collection slug.`,
      );
    }

    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (category) {
      throw new BadRequestException(
        `The category "${category.name}" already uses the slug "${slug}". A collection sharing it would hide that category's page.`,
      );
    }

    const existing = await this.prisma.collection.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeCollectionId) {
      throw new BadRequestException(`A collection with slug "${slug}" already exists.`);
    }
  }

  private async replaceProducts(collectionId: string, productIds: string[]): Promise<void> {
    const found = await this.prisma.product.count({
      where: { id: { in: productIds }, deletedAt: null },
    });
    if (found !== productIds.length) {
      throw new BadRequestException('One or more products do not exist.');
    }

    // Replace wholesale inside a transaction: a partial diff would leave the
    // collection half-updated if the insert failed after the delete.
    await this.prisma.$transaction([
      this.prisma.collectionProduct.deleteMany({ where: { collectionId } }),
      this.prisma.collectionProduct.createMany({
        data: productIds.map((productId, index) => ({ collectionId, productId, sortOrder: index })),
      }),
    ]);
  }

  private withResolvedHero<T extends { heroImageRef: string | null }>(collection: T) {
    return {
      ...collection,
      // Same reason the banner feed resolves its ref server-side: the ref is
      // opaque and its shape differs per storage adapter.
      heroImageUrl: collection.heroImageRef ? this.storage.resolveUrl(collection.heroImageRef) : null,
    };
  }

  private async findOrThrow(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }
}
