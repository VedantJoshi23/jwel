import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartShareItemDto {
  @ApiProperty() @IsUUID() variantId: string;

  @ApiProperty() @IsInt() @Min(1) @Max(999) quantity: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() giftWrap?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) giftNote?: string;
}

export class CreateCartShareDto {
  /**
   * The lines to freeze. Sent by the client because the storefront cart lives
   * in the browser, not on the server — see `CartService.createShare`.
   *
   * No prices: `DOM-SHOPPING` Invariant 11 resolves those at open time, so
   * there is nothing here for a caller to lie about.
   */
  @ApiProperty({ type: [CartShareItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  // A cap, not a policy. It bounds what one anonymous request can write, since
  // creating a share needs no account.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartShareItemDto)
  items: CartShareItemDto[];
}
