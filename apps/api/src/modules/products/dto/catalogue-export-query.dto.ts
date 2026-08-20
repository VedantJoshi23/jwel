import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CatalogueExportQueryDto {
  @ApiPropertyOptional({ description: 'Scope the PDF to one category. Mutually exclusive with collectionId.' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Scope the PDF to one collection. Mutually exclusive with categoryId.' })
  @IsOptional()
  @IsUUID()
  collectionId?: string;
}
