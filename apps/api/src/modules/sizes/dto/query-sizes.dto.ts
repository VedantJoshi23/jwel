import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      'Exclude custom sizes recovered from legacy data. The admin creation ' +
      'form sets this — offering a custom value there would reintroduce the ' +
      'free-text drift this feature exists to stop.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  curatedOnly?: boolean;
}
