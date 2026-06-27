import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

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
}
