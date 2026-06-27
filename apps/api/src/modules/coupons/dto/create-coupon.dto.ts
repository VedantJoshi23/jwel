import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ example: 'SHINE75' }) @IsString() code: string;

  @ApiProperty({ enum: DiscountType }) @IsEnum(DiscountType) discountType: DiscountType;

  @ApiProperty({ description: 'Percent (0-100) for PERCENTAGE/FIRST_ORDER, minor units for FLAT' })
  @IsInt()
  @Min(0)
  value: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minOrderAmountMinorUnits?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) maxRedemptionsPerUser?: number;

  @ApiProperty() @IsDateString() validFrom: string;

  @ApiProperty() @IsDateString() validTo: string;
}
