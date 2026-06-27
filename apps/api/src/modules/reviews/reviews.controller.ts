import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('reviews')
@Controller('api/v1')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @Post('reviews')
  @ApiOperation({ summary: 'Submit a review for a product (FR-5)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.userId, dto);
  }

  @Public()
  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'List approved reviews for a product (FR-5)' })
  listForProduct(@Param('productId') productId: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listForProduct(productId, query);
  }

  @ApiBearerAuth()
  @Get('admin/reviews/pending')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List reviews awaiting moderation' })
  adminListPending(@Query() query: PaginationQueryDto) {
    return this.reviewsService.adminListPending(query);
  }

  @ApiBearerAuth()
  @Patch('admin/reviews/:id/moderate')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Approve or reject a pending review' })
  adminModerate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviewsService.adminModerate(id, dto.status);
  }
}
