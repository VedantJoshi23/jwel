import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListInventoryDto } from './dto/list-inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('api/v1/admin/inventory')
@Roles(Role.ADMIN, Role.STAFF)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary:
      '[Admin/Staff] List inventory, paginated and searchable by product name or SKU — the general ' +
      'counterpart to low-stock, since a healthy-stock item is otherwise unreachable to restock further',
  })
  listInventory(@Query() query: ListInventoryDto) {
    return this.inventoryService.listInventory(query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: '[Admin/Staff] List SKUs at or below their low-stock threshold (FR-18)' })
  listLowStock() {
    return this.inventoryService.listLowStock();
  }

  @Get(':variantId')
  @ApiOperation({ summary: '[Admin/Staff] Get stock levels for a variant' })
  getByVariant(@Param('variantId') variantId: string) {
    return this.inventoryService.getByVariant(variantId);
  }

  @Patch(':variantId/adjust')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Manually adjust on-hand stock (restock, damage write-off, etc.)' })
  adjust(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adminAdjust(variantId, dto.delta, actor);
  }
}
