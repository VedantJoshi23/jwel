import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListInventoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over product name and SKU' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Restrict to items at or below their low-stock threshold',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowStockOnly?: boolean;
}
