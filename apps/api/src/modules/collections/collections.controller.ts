import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { UpsertCollectionDto } from './dto/upsert-collection.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('collections')
@Controller('api/v1')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Public()
  @Get('collections')
  @ApiOperation({ summary: 'Live collections, featured first (FR-23)' })
  listPublic() {
    return this.collectionsService.listPublic();
  }

  @Public()
  @Get('collections/:slug')
  @ApiOperation({ summary: 'One live collection and its published products' })
  async findPublicBySlug(@Param('slug') slug: string, @Query() pagination: PaginationQueryDto) {
    const collection = await this.collectionsService.findPublicBySlug(slug, pagination);
    if (!collection) {
      // The service returns null because "not a collection" is an ordinary
      // outcome for it — every category URL produces one. The HTTP surface
      // still owes a 404, and the storefront treats that as "fall back to the
      // category page", not as an error to show the shopper.
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  @ApiBearerAuth()
  @Get('admin/collections')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] All collections, including scheduled and expired' })
  adminList() {
    return this.collectionsService.adminList();
  }

  @ApiBearerAuth()
  @Post('admin/collections')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Create a collection' })
  adminCreate(@Body() dto: UpsertCollectionDto) {
    return this.collectionsService.adminCreate(dto);
  }

  @ApiBearerAuth()
  @Put('admin/collections/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Update a collection and optionally replace its products' })
  adminUpdate(@Param('id') id: string, @Body() dto: UpsertCollectionDto) {
    return this.collectionsService.adminUpdate(id, dto);
  }

  @ApiBearerAuth()
  @Delete('admin/collections/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Delete a collection' })
  adminDelete(@Param('id') id: string) {
    return this.collectionsService.adminDelete(id);
  }
}
