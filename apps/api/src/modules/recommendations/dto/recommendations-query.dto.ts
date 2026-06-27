import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class LimitQueryDto {
  @ApiPropertyOptional({ default: 12, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;
}

export class RecentlyViewedQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({ description: 'Required for guests; ignored if authenticated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  anonymousId?: string;
}
