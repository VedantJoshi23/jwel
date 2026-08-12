import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAdminQuestionsDto extends PaginationQueryDto {
  // "Needs an answer" is the actionable admin worklist here — there is no
  // approval queue the way Reviews has one (FEAT-PRODUCT-QA §4).
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unanswered?: boolean;
}
