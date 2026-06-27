import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddWishlistItemDto {
  @ApiProperty() @IsString() variantId: string;
}
