import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// See the identical comment on AdminFindReturnsQueryDto (returns module):
// the global ValidationPipe's forbidNonWhitelisted rejects any query
// property that isn't declared on the single DTO class bound to @Query() —
// these filters have to live here, not as separate @Query('x') parameters.
export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;
}
