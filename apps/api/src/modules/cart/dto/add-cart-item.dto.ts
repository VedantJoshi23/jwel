import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty() @IsString() variantId: string;

  @ApiProperty({ minimum: 1, default: 1 }) @IsInt() @Min(1) quantity: number = 1;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() giftWrap?: boolean;

  /**
   * Per line, not per cart — `DOM-SHOPPING` Invariant 4. Together with
   * `giftWrap` this is the "configuration" that makes two lines of the same
   * variant distinct (Invariant 1).
   */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) giftNote?: string;
}
