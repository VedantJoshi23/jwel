import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CertificationType, MetalType } from '@prisma/client';

export class CreateProductVariantDto {
  @ApiProperty() @IsString() sku: string;

  @ApiProperty({ enum: MetalType }) @IsEnum(MetalType) metal: MetalType;

  @ApiPropertyOptional() @IsOptional() @IsString() purity?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;

  @ApiProperty() @IsNumber() @Min(0) weightGrams: number;

  @ApiProperty({ description: 'Base price in minor units (paise)' })
  @IsNumber()
  @Min(0)
  basePriceMinorUnits: number;
}

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;

  @ApiProperty() @IsString() slug: string;

  @ApiProperty() @IsString() categoryId: string;

  @ApiProperty() @IsString() description: string;

  @ApiPropertyOptional({ enum: CertificationType })
  @IsOptional()
  @IsEnum(CertificationType)
  certificationType?: CertificationType;

  @ApiPropertyOptional() @IsOptional() @IsString() certificationDocRef?: string;

  @ApiProperty({ type: [CreateProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}
