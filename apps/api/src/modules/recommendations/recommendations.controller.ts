import { Controller, Get, HttpCode, HttpStatus, Param, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { RecordViewDto } from './dto/record-view.dto';
import { LimitQueryDto, RecentlyViewedQueryDto } from './dto/recommendations-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

@ApiTags('recommendations')
@Controller('api/v1')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('products/:productId/views')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a product view (logged-in or guest) — feeds Recently Viewed' })
  async recordView(
    @Param('productId') productId: string,
    @Body() dto: RecordViewDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<void> {
    await this.recommendationsService.recordView(productId, {
      userId: user?.userId,
      anonymousId: dto.anonymousId,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('recently-viewed')
  @ApiOperation({ summary: 'Recently viewed products for the current identity (logged-in or guest)' })
  getRecentlyViewed(@Query() query: RecentlyViewedQueryDto, @CurrentUser() user: AuthenticatedUser | null) {
    return this.recommendationsService.getRecentlyViewed(
      { userId: user?.userId, anonymousId: query.anonymousId },
      query.limit,
    );
  }

  @Public()
  @Get('products/:productId/recommendations/frequently-bought-together')
  @ApiOperation({ summary: 'Products frequently purchased alongside this one (FR-15)' })
  getFrequentlyBoughtTogether(@Param('productId') productId: string, @Query() query: LimitQueryDto) {
    return this.recommendationsService.getFrequentlyBoughtTogether(productId, query.limit);
  }

  @Public()
  @Get('recommendations/trending')
  @ApiOperation({ summary: 'Site-wide trending products over a recent sales window' })
  getTrending(@Query() query: LimitQueryDto) {
    return this.recommendationsService.getTrending(query.limit);
  }

  @ApiBearerAuth()
  @Get('me/recommendations')
  @ApiOperation({ summary: 'Personalized "recommended for you" — cold-starts to trending for new accounts (FR-14/FR-15)' })
  getPersonalized(@CurrentUser() user: AuthenticatedUser, @Query() query: LimitQueryDto) {
    return this.recommendationsService.getPersonalized(user.userId, query.limit);
  }

  @ApiBearerAuth()
  @Post('admin/recommendations/backfill-co-occurrence')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Rebuild Frequently-Bought-Together signal from full order history' })
  backfillCoOccurrence() {
    return this.recommendationsService.backfillCoOccurrence();
  }
}
