import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PincodeServiceabilityOverride } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreatePincodeOverrideDto } from './dto/create-pincode-override.dto';
import { UpdatePincodeOverrideDto } from './dto/update-pincode-override.dto';
import {
  SHIPPING_PROVIDER,
  ServiceabilityCheckResult,
  ShippingProviderPort,
} from './ports/shipping-provider.port';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProviderPort,
  ) {}

  // --- Public surface ------------------------------------------------------

  checkServiceability(pincode: string): Promise<ServiceabilityCheckResult> {
    return this.provider.checkServiceability(pincode);
  }

  // --- Admin surface ---------------------------------------------------------

  async adminList(pagination: PaginationQueryDto): Promise<PaginatedResult<PincodeServiceabilityOverride>> {
    const [items, total] = await Promise.all([
      this.prisma.pincodeServiceabilityOverride.findMany({
        orderBy: { pincode: 'asc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.pincodeServiceabilityOverride.count(),
    ]);
    return { items, page: pagination.page, pageSize: pagination.pageSize, total };
  }

  async adminCreate(
    dto: CreatePincodeOverrideDto,
    actor: AuthenticatedUser,
  ): Promise<PincodeServiceabilityOverride> {
    const deliverable = dto.deliverable ?? true;
    this.assertNoWindowWhenNonDeliverable(deliverable, dto.estimatedMinDays, dto.estimatedMaxDays);
    this.assertWindowOrdered(dto.estimatedMinDays, dto.estimatedMaxDays);

    const existing = await this.prisma.pincodeServiceabilityOverride.findUnique({
      where: { pincode: dto.pincode },
    });
    if (existing) {
      throw new BadRequestException(
        `An override for pincode "${dto.pincode}" already exists — edit it instead of creating a second one.`,
      );
    }

    const override = await this.prisma.pincodeServiceabilityOverride.create({
      data: {
        pincode: dto.pincode,
        deliverable,
        estimatedMinDays: deliverable ? (dto.estimatedMinDays ?? null) : null,
        estimatedMaxDays: deliverable ? (dto.estimatedMaxDays ?? null) : null,
        note: dto.note ?? null,
      },
    });

    await this.auditLog.record({
      actor,
      action: 'shipping.pincode_override.create',
      entityType: 'PincodeServiceabilityOverride',
      entityId: override.id,
      metadata: { pincode: override.pincode, deliverable: override.deliverable },
    });

    return override;
  }

  async adminUpdate(
    id: string,
    dto: UpdatePincodeOverrideDto,
    actor: AuthenticatedUser,
  ): Promise<PincodeServiceabilityOverride> {
    const existing = await this.findOrThrow(id);

    const deliverable = dto.deliverable ?? existing.deliverable;

    // The non-deliverable conflict check runs against the DTO's own fields,
    // not the merged/inherited ones: turning an existing deliverable+windowed
    // row non-deliverable in the same request clears its window rather than
    // conflicting with it — only a window explicitly sent *alongside*
    // deliverable: false is a real conflict.
    this.assertNoWindowWhenNonDeliverable(deliverable, dto.estimatedMinDays, dto.estimatedMaxDays);

    const estimatedMinDays = dto.estimatedMinDays !== undefined ? dto.estimatedMinDays : (existing.estimatedMinDays ?? undefined);
    const estimatedMaxDays = dto.estimatedMaxDays !== undefined ? dto.estimatedMaxDays : (existing.estimatedMaxDays ?? undefined);

    // Ordering, unlike the conflict check above, is checked against the
    // *effective* (merged) window — an update that only touches one bound
    // must still be caught if it now contradicts the other, unchanged bound.
    if (deliverable) {
      this.assertWindowOrdered(estimatedMinDays, estimatedMaxDays);
    }

    const updated = await this.prisma.pincodeServiceabilityOverride.update({
      where: { id },
      data: {
        deliverable,
        estimatedMinDays: deliverable ? (estimatedMinDays ?? null) : null,
        estimatedMaxDays: deliverable ? (estimatedMaxDays ?? null) : null,
        note: dto.note !== undefined ? dto.note : existing.note,
      },
    });

    await this.auditLog.record({
      actor,
      action: 'shipping.pincode_override.update',
      entityType: 'PincodeServiceabilityOverride',
      entityId: id,
      metadata: { from: existing, to: updated },
    });

    return updated;
  }

  async adminDelete(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.pincodeServiceabilityOverride.delete({ where: { id } });

    await this.auditLog.record({
      actor,
      action: 'shipping.pincode_override.delete',
      entityType: 'PincodeServiceabilityOverride',
      entityId: id,
    });
  }

  // --- Internals -------------------------------------------------------------

  /**
   * Mirrors the database's own `non_deliverable_has_no_window` CHECK
   * constraint, checked here first so a bad request gets a named 400 rather
   * than a raw constraint-violation error surfacing from Postgres — the two
   * checks are deliberately not merged into one per `products.controller.ts`'s
   * own precedent for keeping an HTTP-layer check and a storage-layer
   * guarantee independent.
   */
  private assertNoWindowWhenNonDeliverable(
    deliverable: boolean,
    min: number | undefined,
    max: number | undefined,
  ): void {
    if (!deliverable && (min !== undefined || max !== undefined)) {
      throw new BadRequestException(
        'A non-deliverable pincode cannot carry an estimated delivery window — omit estimatedMinDays/estimatedMaxDays or set deliverable to true.',
      );
    }
  }

  /** Mirrors the database's own `estimate_range_ordered` CHECK constraint. */
  private assertWindowOrdered(min: number | undefined, max: number | undefined): void {
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException('estimatedMinDays must be less than or equal to estimatedMaxDays.');
    }
  }

  private async findOrThrow(id: string): Promise<PincodeServiceabilityOverride> {
    const override = await this.prisma.pincodeServiceabilityOverride.findUnique({ where: { id } });
    if (!override) {
      throw new NotFoundException('Pincode override not found');
    }
    return override;
  }
}
