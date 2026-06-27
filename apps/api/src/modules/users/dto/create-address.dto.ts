import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty() @IsString() line1: string;

  @ApiPropertyOptional() @IsOptional() @IsString() line2?: string;

  @ApiProperty() @IsString() city: string;

  @ApiProperty() @IsString() state: string;

  @ApiProperty() @IsString() @Length(4, 10) pincode: string;

  @ApiPropertyOptional({ default: 'IN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
