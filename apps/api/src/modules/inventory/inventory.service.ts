import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { ListInventoryDto } from './dto/list-inventory.dto';

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Stock reservation is the one place in the catalog where naive read-then-write
 * would oversell under concurrent checkouts. Reserve/release/commit go through
 * conditional raw UPDATEs (`WHERE quantity_on_hand - quantity_reserved >= n`) so
 * the availability check and the mutation happen atomically in a single
 * statement, not as a separate SELECT followed by an UPDATE — see
 * ARCHITECTURE.md §7 (Scalability Strategy, checkout correctness under load).
 */
/**
 * Shape returned by `listLowStock`. Declared explicitly because `$queryRaw`
 * has no generated model type behind it — the aliases in the SQL and this
 * interface are the only thing keeping the API contract camelCase.
 */
export interface LowStockItem {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
}

/**
 * Shape returned by `listInventory`. Same reasoning as `LowStockItem` — a
 * raw, joined query with no generated Prisma model behind its shape.
 *
 * Carries `productName`/`sku` that `listLowStock` deliberately doesn't: this
 * is the admin's only way to *find* a variant to adjust once it is no longer
 * low-stock (the admin Inventory page previously only ever listed low-stock
 * rows, so a healthy-stock item had no path to being restocked further — see
 * `DOM-INVENTORY` for the incident this fixes).
 */
export interface AdminInventoryItem {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
  sku: string;
  productName: string;
  productSlug: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getByVariant(variantId: string) {
    const item = await this.prisma.inventory.findUnique({ where: { variantId } });
    if (!item) {
      throw new NotFoundException('Inventory record not found for this variant');
    }
    return item;
  }

  async reserve(variantId: string, quantity: number, client: Client = this.prisma): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Reservation quantity must be positive');
    }
    const updated = await client.$executeRaw`
      UPDATE inventory_items
      SET quantity_reserved = quantity_reserved + ${quantity}, updated_at = now()
      WHERE variant_id = ${variantId}::uuid
        AND (quantity_on_hand - quantity_reserved) >= ${quantity}
    `;
    if (updated === 0) {
      throw new ConflictException('Insufficient stock available for this item');
    }
  }

  async release(variantId: string, quantity: number, client: Client = this.prisma): Promise<void> {
    await client.$executeRaw`
      UPDATE inventory_items
      SET quantity_reserved = GREATEST(quantity_reserved - ${quantity}, 0), updated_at = now()
      WHERE variant_id = ${variantId}::uuid
    `;
  }

  async commit(variantId: string, quantity: number, client: Client = this.prisma): Promise<void> {
    await client.$executeRaw`
      UPDATE inventory_items
      SET quantity_on_hand = GREATEST(quantity_on_hand - ${quantity}, 0),
          quantity_reserved = GREATEST(quantity_reserved - ${quantity}, 0),
          updated_at = now()
      WHERE variant_id = ${variantId}::uuid
    `;
  }

  async restock(variantId: string, quantity: number, client: Client = this.prisma): Promise<void> {
    await client.$executeRaw`
      UPDATE inventory_items
      SET quantity_on_hand = quantity_on_hand + ${quantity}, updated_at = now()
      WHERE variant_id = ${variantId}::uuid
    `;
  }

  async adminAdjust(variantId: string, delta: number, actor: AuthenticatedUser) {
    await this.getByVariant(variantId);
    if (delta < 0) {
      const result = await this.prisma.$executeRaw`
        UPDATE inventory_items
        SET quantity_on_hand = quantity_on_hand + ${delta}, updated_at = now()
        WHERE variant_id = ${variantId}::uuid AND quantity_on_hand + ${delta} >= quantity_reserved
      `;
      if (result === 0) {
        throw new ConflictException('Cannot reduce stock below currently reserved quantity');
      }
    } else {
      await this.prisma.inventory.update({
        where: { variantId },
        data: { quantityOnHand: { increment: delta } },
      });
    }

    const updated = await this.getByVariant(variantId);

    await this.auditLogService.record({
      actor,
      action: 'inventory.adjusted',
      entityType: 'Inventory',
      entityId: variantId,
      metadata: { delta, quantityOnHandAfter: updated.quantityOnHand },
    });

    return updated;
  }

  /**
   * Raw SQL because the predicate compares two columns to each other, which
   * Prisma's `where` cannot express.
   *
   * The columns MUST be aliased. `$queryRaw` bypasses Prisma's `@map`
   * translation entirely, so `SELECT *` returns the physical snake_case names
   * (`variant_id`, `quantity_on_hand`, …) rather than the camelCase fields
   * every other endpoint returns. The admin Inventory page consumed
   * `item.variantId`, got `undefined`, and crashed the whole page on
   * `.slice()` — a white screen, not a missing column. It went unnoticed
   * because the page only breaks once at least one inventory row exists.
   */
  listLowStock(): Promise<LowStockItem[]> {
    return this.prisma.$queryRaw<LowStockItem[]>`
      SELECT
        variant_id          AS "variantId",
        quantity_on_hand    AS "quantityOnHand",
        quantity_reserved   AS "quantityReserved",
        low_stock_threshold AS "lowStockThreshold"
      FROM inventory_items
      WHERE (quantity_on_hand - quantity_reserved) <= low_stock_threshold
      ORDER BY (quantity_on_hand - quantity_reserved) ASC
    `;
  }

  /**
   * The general-purpose counterpart to `listLowStock` — paginated, joined to
   * product/variant so the admin can find an item by name or SKU rather than
   * only ever seeing it while it happens to be low-stock. `q` and
   * `lowStockOnly` are built as separate `Prisma.sql` fragments and reused
   * across the page query and the count query, since Prisma's `where` object
   * still can't express the `on_hand - reserved <= threshold` comparison
   * (same reason `listLowStock` is raw SQL).
   */
  async listInventory(query: ListInventoryDto): Promise<PaginatedResult<AdminInventoryItem>> {
    const { page, pageSize, q, lowStockOnly } = query;

    const conditions: Prisma.Sql[] = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR v.sku ILIKE ${pattern})`);
    }
    if (lowStockOnly) {
      conditions.push(Prisma.sql`(i.quantity_on_hand - i.quantity_reserved) <= i.low_stock_threshold`);
    }
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const [items, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminInventoryItem[]>`
        SELECT
          i.variant_id          AS "variantId",
          i.quantity_on_hand    AS "quantityOnHand",
          i.quantity_reserved   AS "quantityReserved",
          i.low_stock_threshold AS "lowStockThreshold",
          v.sku                 AS "sku",
          p.name                AS "productName",
          p.slug                AS "productSlug"
        FROM inventory_items i
        JOIN product_variants v ON v.id = i.variant_id
        JOIN products p ON p.id = v.product_id
        ${where}
        ORDER BY p.name ASC, v.sku ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM inventory_items i
        JOIN product_variants v ON v.id = i.variant_id
        JOIN products p ON p.id = v.product_id
        ${where}
      `,
    ]);

    return { items, page, pageSize, total: Number(countRows[0].count) };
  }
}
