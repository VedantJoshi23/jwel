import { ApiPropertyOptional } from '@nestjs/swagger';
import { SizeScheme } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;

  // `null` explicitly promotes a subcategory to top-level; `undefined` (field
  // absent) leaves the parent untouched — so it's validated as a UUID only
  // when a non-null value is actually sent.
  @ApiPropertyOptional({ nullable: true, description: 'New parent id, or null to make top-level' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;

  // `null` explicitly reverts to "inherit from parent" (schema.prisma's own
  // documented meaning of a NULL sizeScheme); `undefined` leaves it
  // untouched. `NONE` is the distinct "this category has no size dimension"
  // value (e.g. Earrings) — see FEAT-SIZE-TAXONOMY.
  @ApiPropertyOptional({ enum: SizeScheme, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(SizeScheme)
  sizeScheme?: SizeScheme | null;
}
