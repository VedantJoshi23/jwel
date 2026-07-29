import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// The global ValidationPipe (main.ts) runs with `forbidNonWhitelisted: true`,
// and NestJS hands a single @Query() DTO binding the *entire* raw query
// string — so `status` has to be a validated property of this class, not a
// second `@Query('status')` parameter alongside `@Query() query:
// PaginationQueryDto`. The latter looked fine locally (nothing enforces the
// whitelist without a real ValidationPipe in the request path) and only
// 400ed against a real app, which is why an integration test is what caught
// it, not the unit tests mocking the service directly.
export class AdminFindReturnsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReturnStatus })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;
}
