import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { BulkImportService } from './bulk-import.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ALLOWED_IMAGE_MIME_REGEX, MAX_IMAGE_BYTES } from '../../common/media/image-upload.constraints';

// This file used to carry these as literals, with a comment arguing the
// duplication was deliberate: pipe configuration at the HTTP boundary is a
// different layer from the service's defense-in-depth re-check, so the two
// should not be coupled.
//
// That argument is about having two independent *checks*, and it still holds
// — both are still here, and neither trusts the other. It does not require
// two copies of the *numbers*. Keeping the literals in two files meant
// raising the cap in one and not the other would produce a route that
// accepts a file the service then rejects. A third route (admin/uploads)
// would have made it three copies, which is what forced the issue.
const MAX_MEDIA_BYTES = MAX_IMAGE_BYTES;
const ALLOWED_MEDIA_MIME_REGEX = ALLOWED_IMAGE_MIME_REGEX;

@ApiTags('products')
@Controller('api/v1')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly bulkImportService: BulkImportService,
  ) {}

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Browse published products (FR-2, FR-3 fallback)' })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('products/:slug')
  @ApiOperation({ summary: 'Get a published product by slug (FR-4)' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Get('admin/products')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List all products including draft/archived (Admin Portal)' })
  adminFindAll(@Query() query: QueryProductsDto) {
    return this.productsService.adminFindAll(query);
  }

  @ApiBearerAuth()
  @Get('admin/products/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Get any product (incl. draft/archived) by id' })
  adminFindOne(@Param('id') id: string) {
    return this.productsService.adminFindOne(id);
  }

  @ApiBearerAuth()
  @Get('admin/categories')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List all categories, for populating a product form' })
  adminListCategories() {
    return this.productsService.listCategories();
  }

  @ApiBearerAuth()
  @Post('admin/categories')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Create a category (slug auto-derived from name if omitted)' })
  adminCreateCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @ApiBearerAuth()
  @Patch('admin/categories/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Update a category' })
  adminUpdateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  @ApiBearerAuth()
  @Delete('admin/categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Delete an empty category (no products, no subcategories)' })
  adminDeleteCategory(@Param('id') id: string) {
    return this.productsService.deleteCategory(id);
  }

  @ApiBearerAuth()
  @Post('admin/products')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Create a product with its variants (FR-17)' })
  adminCreate(@Body() dto: CreateProductDto) {
    return this.productsService.adminCreate(dto);
  }

  @ApiBearerAuth()
  @Patch('admin/products/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Update product content/status (FR-17)' })
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.adminUpdate(id, dto);
  }

  @ApiBearerAuth()
  @Delete('admin/products/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Archive (soft-delete) a product' })
  adminDelete(@Param('id') id: string) {
    return this.productsService.adminDelete(id);
  }

  @ApiBearerAuth()
  @Post('admin/products/bulk-import')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary:
      '[Admin/Staff] Bulk-create products from a CSV (one row = one product + one variant). Columns: name,slug,category_slug,description,certification_type,certification_doc_ref,sku,metal,purity,size,weight_grams,base_price_minor_units',
  })
  async bulkImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded — expected a multipart field named "file"');
    }
    return this.bulkImportService.importProductsCsv(file.buffer);
  }

  @ApiBearerAuth()
  @Post('admin/products/:id/media')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: '[Admin/Staff] Upload a product photo (jpeg/png/webp, max 8 MB)' })
  addMedia(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: ALLOWED_MEDIA_MIME_REGEX })
        .addMaxSizeValidator({ maxSize: MAX_MEDIA_BYTES })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.productsService.addMedia(id, file);
  }

  @ApiBearerAuth()
  @Delete('admin/products/:id/media/:mediaId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Remove a product photo' })
  removeMedia(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.productsService.removeMedia(id, mediaId);
  }

  @ApiBearerAuth()
  @Put('admin/products/:id/media/reorder')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Reorder a product’s photos' })
  reorderMedia(@Param('id') id: string, @Body() dto: ReorderMediaDto) {
    return this.productsService.reorderMedia(id, dto.mediaIds);
  }
}
