import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

// Mirrors ProductsService's own limits (SECURITY.md §6 — validated server-
// side before the file is handed to the Storage port). Duplicated as a
// literal, not imported from the service, on purpose: this is Multer/pipe
// configuration for the HTTP boundary, a different layer than the service's
// own defense-in-depth check on the same numbers.
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const ALLOWED_MEDIA_MIME_REGEX = /^image\/(jpeg|png|webp)$/;

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
