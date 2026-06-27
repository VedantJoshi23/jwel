import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('api/v1')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Checkout: create an order from cart items (FR-9)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.userId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List the current user’s orders (FR-10)' })
  findForUser(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.ordersService.findForUser(user.userId, query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail / tracking timeline (FR-10)' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOne(id, user);
  }

  @Get('admin/orders')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List all orders (FR-19)' })
  adminFindAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.adminFindAll(query);
  }

  @Patch('admin/orders/:id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Transition order status (FR-19)' })
  adminUpdateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.adminUpdateStatus(id, dto.status, dto.note);
  }
}
