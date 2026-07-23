import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class UpdateVariantPriceDto {
  @ApiPropertyOptional() @IsString() variantId: string;

  @ApiPropertyOptional({ description: 'Base price in minor units (paise)' })
  @IsNumber()
  @Min(0)
  basePriceMinorUnits: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  // Not a Product column — applied to ProductVariant rows separately in
  // ProductsService.adminUpdate. Lets the admin edit form fix up the price
  // an import script left as a placeholder without a dedicated variant
  // endpoint (products here have exactly one variant almost always; this
  // stays an array since CreateProductDto already allows more than one).
  @ApiPropertyOptional({ type: [UpdateVariantPriceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantPriceDto)
  variantPriceUpdates?: UpdateVariantPriceDto[];
}
