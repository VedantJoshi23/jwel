import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Stock reservation is the one place in the catalog where naive read-then-write
 * would oversell under concurrent checkouts. Reserve/release/commit go through
 * conditional raw UPDATEs (`WHERE quantity_on_hand - quantity_reserved >= n`) so
 * the availability check and the mutation happen atomically in a single
 * statement, not as a separate SELECT followed by an UPDATE — see
 * ARCHITECTURE.md §7 (Scalability Strategy, checkout correctness under load).
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  async adminAdjust(variantId: string, delta: number) {
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
    return this.getByVariant(variantId);
  }

  listLowStock() {
    return this.prisma.$queryRaw`
      SELECT * FROM inventory_items
      WHERE (quantity_on_hand - quantity_reserved) <= low_stock_threshold
      ORDER BY (quantity_on_hand - quantity_reserved) ASC
    `;
  }
}
