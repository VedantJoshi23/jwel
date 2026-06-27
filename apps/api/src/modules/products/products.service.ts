import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const productInclude = {
  category: true,
  variants: true,
  media: { orderBy: { sortOrder: 'asc' as const } },
};

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function minVariantPrice(product: ProductWithRelations): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Postgres serves catalog browsing directly at MVP scale. Price filtering/
   * sorting happens per-product-min-variant-price, which Prisma can't express
   * as a single SQL ORDER BY across a 1:many relation — so the matching set is
   * fetched once and sorted/paginated in memory. ARCHITECTURE.md already
   * designates Elasticsearch as the long-term primary search/browse path;
   * this is the documented interim approach, not the final scaling story.
   */
  async findAll(query: QueryProductsDto): Promise<PaginatedResult<ProductWithRelations>> {
    const { page, pageSize, category, metal, q, priceMin, priceMax, sort } = query;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      deletedAt: null,
      ...(category && { category: { slug: category } }),
      ...(metal && { variants: { some: { metal } } }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
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

    return { items, page, pageSize, total };
  }

  async findBySlug(slug: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.PUBLISHED, deletedAt: null },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // The Admin Portal's Products module (Milestone 10) needs to see drafts
  // and archived products too — `findAll` above is PUBLISHED-only by design
  // (it's the public catalog browse path). No filtering/sorting beyond
  // pagination, unlike `findAll` — an admin catalog list is a much smaller,
  // more occasional read than the storefront's, so the same in-memory
  // price-sort complexity isn't worth duplicating here.
  async adminFindAll(query: PaginationQueryDto): Promise<PaginatedResult<ProductWithRelations>> {
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
    return { items, page, pageSize, total };
  }

  async adminFindOne(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async adminCreate(dto: CreateProductDto): Promise<ProductWithRelations> {
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
    return product;
  }

  async adminUpdate(id: string, dto: UpdateProductDto): Promise<ProductWithRelations> {
    await this.adminFindOne(id);
    const product = await this.prisma.product.update({ where: { id }, data: dto, include: productInclude });
    this.eventBus.emit('product.upserted', { productId: product.id });
    return product;
  }

  async adminDelete(id: string): Promise<void> {
    await this.adminFindOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });
    this.eventBus.emit('product.deleted', { productId: id });
  }
}
