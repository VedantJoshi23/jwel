import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

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
}
