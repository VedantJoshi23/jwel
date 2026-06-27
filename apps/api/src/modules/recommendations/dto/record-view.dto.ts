import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordViewDto {
  @ApiPropertyOptional({
    description:
      'Client-generated id (e.g. a UUID persisted in localStorage) identifying a guest. Ignored if the request is authenticated — the logged-in userId takes precedence.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  anonymousId?: string;
}
