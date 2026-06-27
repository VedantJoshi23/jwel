import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/admin/analytics')
@Roles(Role.ADMIN, Role.STAFF)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '[Admin/Staff] Dashboard summary: revenue, orders, top products, low stock, pending reviews (FR-21)' })
  getDashboardSummary(@Query() query: DashboardQueryDto) {
    return this.analyticsService.getDashboardSummary(query.windowDays);
  }
}
