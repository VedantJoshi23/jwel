import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { UpsertBannerDto } from './dto/upsert-banner.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('cms')
@Controller('api/v1')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get('cms/banners')
  @ApiOperation({ summary: 'Active homepage banners within their scheduling window (FR-23)' })
  listActiveBanners() {
    return this.cmsService.listActiveBanners();
  }

  @ApiBearerAuth()
  @Get('admin/cms/banners')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] All banners, including inactive/scheduled' })
  adminListBanners() {
    return this.cmsService.adminListBanners();
  }

  @ApiBearerAuth()
  @Post('admin/cms/banners')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Create a banner' })
  adminCreateBanner(@Body() dto: UpsertBannerDto) {
    return this.cmsService.adminCreateBanner(dto);
  }

  @ApiBearerAuth()
  @Put('admin/cms/banners/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Update a banner' })
  adminUpdateBanner(@Param('id') id: string, @Body() dto: UpsertBannerDto) {
    return this.cmsService.adminUpdateBanner(id, dto);
  }

  @ApiBearerAuth()
  @Delete('admin/cms/banners/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Delete a banner' })
  adminDeleteBanner(@Param('id') id: string) {
    return this.cmsService.adminDeleteBanner(id);
  }
}
