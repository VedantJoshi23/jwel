import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty() @IsString() variantId: string;

  @ApiProperty({ minimum: 1, default: 1 }) @IsInt() @Min(1) quantity: number = 1;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() giftWrap?: boolean;
}
