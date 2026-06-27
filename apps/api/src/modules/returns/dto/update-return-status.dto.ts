import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateReturnStatusDto {
  @ApiProperty({ enum: ReturnStatus }) @IsEnum(ReturnStatus) status: ReturnStatus;

  @ApiPropertyOptional({ description: 'Required when transitioning to REFUNDED' })
  @IsOptional()
  @IsInt()
  @Min(0)
  refundAmountMinorUnits?: number;
}
