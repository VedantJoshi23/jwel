import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) name: string;

  // Optional: derived from `name` by the service when omitted. Accepting a
  // caller-supplied slug lets the admin keep a stable URL when renaming.
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;

  @ApiPropertyOptional({ description: 'Parent category id — omit for a top-level category' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}
