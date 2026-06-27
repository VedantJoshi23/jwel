import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CertificationType, MetalType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SearchQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'diamond ring' })
  @IsString()
  q: string;

  @ApiPropertyOptional({ description: 'Category slug facet filter' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: MetalType })
  @IsOptional()
  @IsEnum(MetalType)
  metal?: MetalType;

  @ApiPropertyOptional({ enum: CertificationType })
  @IsOptional()
  @IsEnum(CertificationType)
  certification?: CertificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;
}
