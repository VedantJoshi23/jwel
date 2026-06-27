import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReturnStatus } from '@prisma/client';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('api/v1')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post('returns')
  @ApiOperation({ summary: 'Request a return for a delivered order item (FR-11)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReturnDto) {
    return this.returnsService.create(user.userId, dto);
  }

  @Get('returns')
  @ApiOperation({ summary: 'List the current user’s return requests' })
  findForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.findForUser(user.userId);
  }

  @Get('returns/:id')
  @ApiOperation({ summary: 'Get a return request’s status/timeline' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.returnsService.findOne(id, user);
  }

  @Get('admin/returns')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiQuery({ name: 'status', enum: ReturnStatus, required: false })
  @ApiOperation({ summary: '[Admin/Staff] List return requests, optionally filtered by status' })
  adminFindAll(@Query() query: PaginationQueryDto, @Query('status') status?: ReturnStatus) {
    return this.returnsService.adminFindAll(query, status);
  }

  @Patch('admin/returns/:id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Approve, reject, or process a return (restocks inventory on refund)' })
  adminUpdateStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto) {
    return this.returnsService.adminUpdateStatus(id, dto.status, dto.refundAmountMinorUnits);
  }
}
