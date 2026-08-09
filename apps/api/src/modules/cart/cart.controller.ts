import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CreateCartShareDto } from './dto/create-cart-share.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user’s persisted cart (FR-7)' })
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart, or increase its quantity if already present' })
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.userId, dto);
  }

  @Patch('items/:variantId')
  @ApiOperation({ summary: 'Set the quantity of a cart line item' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user.userId, variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param('variantId') variantId: string) {
    return this.cartService.removeItem(user.userId, variantId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the entire cart' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clear(user.userId);
  }

  /**
   * Public, like the wishlist's share endpoint — and public on the *write*
   * side too, which the wishlist's is not.
   *
   * A guest has a cart (Invariant 5) and may share it, so requiring an account
   * would refuse the person most likely to be sending a link to someone else.
   * The payload cannot express anything but variant ids and quantities, and
   * the global throttle bounds the rest.
   */
  @Public()
  @Post('shares')
  @ApiOperation({ summary: 'Freeze the given cart lines and return a share token' })
  createShare(@Body() dto: CreateCartShareDto) {
    return this.cartService.createShare(dto);
  }

  @Public()
  @Get('shared/:token')
  @ApiOperation({ summary: 'Open a shared cart — frozen items, live prices (no auth)' })
  getShare(@Param('token') token: string) {
    return this.cartService.getShare(token);
  }
}
