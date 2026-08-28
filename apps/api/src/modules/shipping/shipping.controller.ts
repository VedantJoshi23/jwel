import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CheckServiceabilityDto } from './dto/check-serviceability.dto';
import { CreatePincodeOverrideDto } from './dto/create-pincode-override.dto';
import { UpdatePincodeOverrideDto } from './dto/update-pincode-override.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('shipping')
@Controller('api/v1')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Public()
  @Get('shipping/serviceability')
  @ApiOperation({
    summary:
      'Interim pincode deliverability + estimated delivery window (FEAT-DELIVERY-ESTIMATE). ' +
      'Not a live carrier check — see the `source` field.',
  })
  checkServiceability(@Query() dto: CheckServiceabilityDto) {
    return this.shippingService.checkServiceability(dto.pincode);
  }

  @ApiBearerAuth()
  @Get('admin/shipping/pincode-overrides')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List pincode serviceability exceptions' })
  adminList(@Query() pagination: PaginationQueryDto) {
    return this.shippingService.adminList(pagination);
  }

  @ApiBearerAuth()
  @Post('admin/shipping/pincode-overrides')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Add a pincode exception' })
  adminCreate(@Body() dto: CreatePincodeOverrideDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.shippingService.adminCreate(dto, actor);
  }

  @ApiBearerAuth()
  @Patch('admin/shipping/pincode-overrides/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Update a pincode exception' })
  adminUpdate(
    @Param('id') id: string,
    @Body() dto: UpdatePincodeOverrideDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.shippingService.adminUpdate(id, dto, actor);
  }

  @ApiBearerAuth()
  @Delete('admin/shipping/pincode-overrides/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Remove a pincode exception' })
  adminDelete(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.shippingService.adminDelete(id, actor);
  }
}
