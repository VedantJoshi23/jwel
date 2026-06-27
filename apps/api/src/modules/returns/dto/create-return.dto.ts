import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateReturnDto {
  @ApiProperty() @IsString() orderItemId: string;

  @ApiProperty({ enum: ReturnReason }) @IsEnum(ReturnReason) reason: ReturnReason;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
