import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum UserStatusFilter {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ALL = 'all',
}

export class ListUsersDto extends PaginationQueryDto {
  // Defaults to ALL rather than ACTIVE: a suspended account was previously
  // unreachable from this list at all — no filter, no search, nothing — which
  // meant a suspension had no path back. Showing everyone by default is what
  // makes the status column and the Unsuspend action reachable without the
  // admin first having to know a filter exists.
  @ApiPropertyOptional({ enum: UserStatusFilter, default: UserStatusFilter.ALL })
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ALL;
}
