import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SizeScheme } from '@prisma/client';

export class QuerySizesDto {
  @ApiPropertyOptional({
    enum: SizeScheme,
    description:
      'Restrict to one sizing scheme. Omitted returns every scheme, which the admin ' +
      'product form uses so it can switch schemes without a second round trip.',
  })
  @IsOptional()
  @IsEnum(SizeScheme)
  scheme?: SizeScheme;
}
