import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QnaService } from './qna.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { ModerateQnaDto } from './dto/moderate-qna.dto';
import { ListAdminQuestionsDto } from './dto/list-admin-questions.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('qna')
@Controller('api/v1')
export class QnaController {
  constructor(private readonly qna: QnaService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('products/:productId/questions')
  @ApiOperation({ summary: 'List visible questions with visible answers for a product (FEAT-PRODUCT-QA)' })
  listForProduct(
    @Param('productId') productId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.qna.listForProduct(productId, query, user?.userId);
  }

  @ApiBearerAuth()
  @Post('products/:productId/questions')
  @ApiOperation({ summary: 'Ask a question about a product' })
  askQuestion(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.qna.askQuestion(productId, user.userId, dto);
  }

  @ApiBearerAuth()
  @Post('questions/:questionId/answers')
  @ApiOperation({ summary: 'Answer a question — same route for a customer or the admin (Invariant 6)' })
  postAnswer(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnswerDto,
  ) {
    return this.qna.postAnswer(questionId, user.userId, dto);
  }

  @ApiBearerAuth()
  @Post('questions/:questionId/upvote')
  @ApiOperation({ summary: 'Upvote a question' })
  upvoteQuestion(@Param('questionId') questionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qna.upvoteQuestion(questionId, user.userId);
  }

  @ApiBearerAuth()
  @Delete('questions/:questionId/upvote')
  @ApiOperation({ summary: "Remove the caller's upvote from a question" })
  removeQuestionUpvote(@Param('questionId') questionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qna.removeQuestionUpvote(questionId, user.userId);
  }

  @ApiBearerAuth()
  @Post('answers/:answerId/upvote')
  @ApiOperation({ summary: 'Upvote an answer' })
  upvoteAnswer(@Param('answerId') answerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qna.upvoteAnswer(answerId, user.userId);
  }

  @ApiBearerAuth()
  @Delete('answers/:answerId/upvote')
  @ApiOperation({ summary: "Remove the caller's upvote from an answer" })
  removeAnswerUpvote(@Param('answerId') answerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qna.removeAnswerUpvote(answerId, user.userId);
  }

  @ApiBearerAuth()
  @Get('admin/qa/questions')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List every question with product/user context' })
  adminListQuestions(@Query() query: ListAdminQuestionsDto) {
    return this.qna.adminListQuestions(query);
  }

  @ApiBearerAuth()
  @Patch('admin/qa/questions/:id/moderate')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Hide or unhide a question (cascades to its whole thread)' })
  adminModerateQuestion(@Param('id') id: string, @Body() dto: ModerateQnaDto) {
    return this.qna.adminModerateQuestion(id, dto.hidden);
  }

  @ApiBearerAuth()
  @Patch('admin/qa/answers/:id/moderate')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] Hide or unhide a single answer' })
  adminModerateAnswer(@Param('id') id: string, @Body() dto: ModerateQnaDto) {
    return this.qna.adminModerateAnswer(id, dto.hidden);
  }
}
