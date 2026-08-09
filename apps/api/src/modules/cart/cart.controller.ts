import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService, CartIdentity } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CreateCartShareDto } from './dto/create-cart-share.dto';
import { ClaimCartDto } from './dto/claim-cart.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

/** The header a guest's browser sends to identify its own cart. */
const GUEST_CART_HEADER = 'x-guest-cart-token';

/**
 * Resolves whose cart this request is about — `DOM-SHOPPING` Invariant 5's XOR,
 * at the edge.
 *
 * **A signed-in user always wins.** If a request carries both a token and a
 * guest header, the account is used and the header ignored: otherwise anyone
 * could read or edit a guest cart by presenting its token alongside their own
 * login, and a guest token is an unauthenticated bearer credential that travels
 * in a header.
 *
 * A request with neither is refused by the caller, not silently given an empty
 * cart — that would quietly discard whatever a shopper just added.
 */
function requireIdentity(user: AuthenticatedUser | null, guestToken?: string): CartIdentity {
  if (user?.userId) return { userId: user.userId };
  if (guestToken) return { guestToken };
  // Refused rather than served an empty cart, which would quietly discard
  // whatever the shopper just added.
  throw new UnauthorizedException(
    `Send a ${GUEST_CART_HEADER} header or sign in to use a cart.`,
  );
}

@ApiTags('cart')
@ApiBearerAuth()
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Every cart route below is `@Public()` with an optional JWT: a guest has a
   * cart (Invariant 5) and must be able to use one without an account. The
   * guard still runs, so a signed-in caller is identified; it simply does not
   * refuse an anonymous one.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiHeader({ name: GUEST_CART_HEADER, required: false })
  @ApiOperation({ summary: 'Get the cart for this user or guest session (FR-7)' })
  getCart(
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers(GUEST_CART_HEADER) guestToken?: string,
  ) {
    const identity = requireIdentity(user, guestToken);
    return this.cartService.getCart(identity);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('items')
  @ApiHeader({ name: GUEST_CART_HEADER, required: false })
  @ApiOperation({ summary: 'Add a line, or increase the quantity of a matching one' })
  addItem(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: AddCartItemDto,
    @Headers(GUEST_CART_HEADER) guestToken?: string,
  ) {
    return this.cartService.addItem(requireIdentity(user, guestToken), dto);
  }

  /**
   * Addressed by **line id**, not variant id.
   *
   * A variant can now appear in a cart more than once — wrapped and unwrapped
   * are two lines (Invariant 1) — so `:variantId` stopped identifying anything.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('items/:lineId')
  @ApiHeader({ name: GUEST_CART_HEADER, required: false })
  @ApiOperation({ summary: 'Set the quantity of one cart line' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers(GUEST_CART_HEADER) guestToken?: string,
  ) {
    return this.cartService.updateItemQuantity(requireIdentity(user, guestToken), lineId, dto.quantity);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('items/:lineId')
  @ApiHeader({ name: GUEST_CART_HEADER, required: false })
  @ApiOperation({ summary: 'Remove one cart line' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param('lineId') lineId: string,
    @Headers(GUEST_CART_HEADER) guestToken?: string,
  ) {
    return this.cartService.removeItem(requireIdentity(user, guestToken), lineId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete()
  @ApiHeader({ name: GUEST_CART_HEADER, required: false })
  @ApiOperation({ summary: 'Clear the cart' })
  clear(
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers(GUEST_CART_HEADER) guestToken?: string,
  ) {
    return this.cartService.clear(requireIdentity(user, guestToken));
  }

  /**
   * Hands a guest cart to the account that just signed in — Invariants 6 and
   * 17.
   *
   * Requires a real account, deliberately: this is the one cart operation that
   * cannot be done by a guest, because it is the moment they stop being one.
   *
   * With two non-empty carts and no strategy it returns `conflict` and changes
   * **nothing** — the prompt belongs to the client and the choice to the
   * customer (Invariant 12).
   */
  @Post('claim')
  @ApiOperation({ summary: 'Claim a guest cart into the signed-in account (Invariants 6, 17)' })
  claim(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClaimCartDto) {
    return this.cartService.claimGuestCart(user.userId, dto.guestToken, dto.strategy);
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
