import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimCartDto {
  @ApiProperty({ description: "The guest session's cart token" })
  @IsString()
  @MaxLength(128)
  guestToken: string;

  /**
   * Omitted on the first call. `DOM-SHOPPING` Invariant 12 forbids silently
   * discarding either cart, so with two non-empty carts the API reports a
   * conflict and waits to be told which the customer chose.
   *
   * `replace` keeps the cart they are **currently holding** — the guest one —
   * and moves the older account cart to their wishlist (Invariant 17).
   */
  @ApiPropertyOptional({ enum: ['merge', 'replace'] })
  @IsOptional()
  @IsIn(['merge', 'replace'])
  strategy?: 'merge' | 'replace';
}
