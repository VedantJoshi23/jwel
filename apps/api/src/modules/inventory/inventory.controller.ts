import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('api/v1/admin/inventory')
@Roles(Role.ADMIN, Role.STAFF)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

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
  adjust(@Param('variantId') variantId: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adminAdjust(variantId, dto.delta);
  }
}
