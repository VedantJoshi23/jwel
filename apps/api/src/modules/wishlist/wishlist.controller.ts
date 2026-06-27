import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('wishlist')
@Controller('api/v1/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get the current user’s wishlist (FR-6)' })
  getWishlist(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlistService.getWishlist(user.userId);
  }

  @ApiBearerAuth()
  @Post('items')
  @ApiOperation({ summary: 'Save an item to the wishlist' })
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(user.userId, dto.variantId);
  }

  @ApiBearerAuth()
  @Delete('items/:variantId')
  @ApiOperation({ summary: 'Remove an item from the wishlist' })
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param('variantId') variantId: string) {
    return this.wishlistService.removeItem(user.userId, variantId);
  }

  @Public()
  @Get('shared/:shareToken')
  @ApiOperation({ summary: 'View a shared wishlist by its share token (no auth required)' })
  getShared(@Param('shareToken') shareToken: string) {
    return this.wishlistService.getByShareToken(shareToken);
  }
}
