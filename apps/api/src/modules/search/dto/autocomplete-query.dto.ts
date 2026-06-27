import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class AutocompleteQueryDto {
  @ApiProperty({ example: 'gold ch' })
  @IsString()
  @MinLength(1)
  q: string;

  @ApiPropertyOptional({ default: 8, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 8;
}
