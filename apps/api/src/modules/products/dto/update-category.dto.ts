import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

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
}
