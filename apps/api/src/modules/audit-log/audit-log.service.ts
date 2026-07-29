import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export interface RecordAuditLogInput {
  actor: AuthenticatedUser;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget from the caller's perspective is tempting but wrong here:
  // an admin action whose audit entry silently failed to write is exactly the
  // kind of gap this module exists to close. Callers await this after their
  // mutation has already committed, so a failure here surfaces as a real
  // error on the request rather than a log line nobody reads.
  record(input: RecordAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorEmail: input.actor.email,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as never,
      },
    });
  }

  async list(filter: AuditLogFilter, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = {
      ...(filter.entityType && { entityType: filter.entityType }),
      ...(filter.entityId && { entityId: filter.entityId }),
      ...(filter.actorId && { actorId: filter.actorId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }
}
