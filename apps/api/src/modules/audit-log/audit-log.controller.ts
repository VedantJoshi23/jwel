import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('audit-log')
@ApiBearerAuth()
@Controller('api/v1/admin/audit-log')
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] List audit log entries, optionally filtered by entity or actor' })
  list(@Query() query: AuditLogQueryDto) {
    const { entityType, entityId, actorId } = query;
    return this.auditLogService.list({ entityType, entityId, actorId }, query);
  }
}
