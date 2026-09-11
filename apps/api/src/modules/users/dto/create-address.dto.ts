import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsAddressText, IsPincode, Trim } from '../../../common/validation/address';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  label?: string;

  // Same rules as an order's shipping address, because a saved address is
  // copied into one at checkout. `@Length(4, 10)` previously let "ABCD" be
  // saved, and it would then have been refused only when the customer tried
  // to pay with it.
  @ApiProperty() @IsAddressText(200) line1: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(200) line2?: string;

  @ApiProperty() @IsAddressText(100) city: string;

  @ApiProperty() @IsAddressText(100) state: string;

  @ApiProperty({ description: '6-digit Indian PIN code, e.g. "400001"' }) @IsPincode() pincode: string;

  @ApiPropertyOptional({ default: 'IN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
