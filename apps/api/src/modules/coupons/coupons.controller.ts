import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('api/v1')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate a coupon code against the current cart subtotal (FR-8)' })
  validate(@CurrentUser() user: AuthenticatedUser, @Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, dto.subtotalMinorUnits, user.userId);
  }

  @Get('admin/coupons')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List coupons (FR-22)' })
  adminList() {
    return this.couponsService.adminList();
  }

  @Post('admin/coupons')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Create a coupon campaign (FR-22)' })
  adminCreate(@Body() dto: CreateCouponDto) {
    return this.couponsService.adminCreate(dto);
  }

  @Patch('admin/coupons/:id/deactivate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Deactivate a coupon' })
  adminDeactivate(@Param('id') id: string) {
    return this.couponsService.adminDeactivate(id);
  }
}
