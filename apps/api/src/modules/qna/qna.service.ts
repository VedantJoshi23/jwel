import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { ListAdminQuestionsDto } from './dto/list-admin-questions.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';
import type {
  AdminAnswerItem,
  AdminQuestionItem,
  AnswerItem,
  QnaAuthor,
  QuestionItem,
} from './qna.types';

const publicUserSelect = { id: true, name: true, deletedAt: true, role: true } as const;
type PublicUserRow = { id: string; name: string | null; deletedAt: Date | null; role: Role };

const adminUserSelect = { id: true, name: true, email: true, role: true } as const;
type AdminUserRow = { id: string; name: string | null; email: string; role: Role };

const answerWithUser = Prisma.validator<Prisma.AnswerDefaultArgs>()({
  include: { user: { select: publicUserSelect }, _count: { select: { upvotes: true } } },
});
type AnswerWithUser = Prisma.AnswerGetPayload<typeof answerWithUser>;

const questionWithRelations = Prisma.validator<Prisma.QuestionDefaultArgs>()({
  include: {
    user: { select: publicUserSelect },
    answers: {
      where: { isHidden: false },
      include: { user: { select: publicUserSelect }, _count: { select: { upvotes: true } } },
      orderBy: { createdAt: 'asc' },
    },
    _count: { select: { upvotes: true } },
  },
});
type QuestionWithRelations = Prisma.QuestionGetPayload<typeof questionWithRelations>;

const adminAnswerWithUser = Prisma.validator<Prisma.AnswerDefaultArgs>()({
  include: { user: { select: adminUserSelect }, _count: { select: { upvotes: true } } },
});
type AdminAnswerWithUser = Prisma.AnswerGetPayload<typeof adminAnswerWithUser>;

const adminQuestionWithRelations = Prisma.validator<Prisma.QuestionDefaultArgs>()({
  include: {
    user: { select: adminUserSelect },
    product: { select: { id: true, name: true, slug: true, media: { take: 1, orderBy: { sortOrder: 'asc' } } } },
    answers: {
      include: { user: { select: adminUserSelect }, _count: { select: { upvotes: true } } },
      orderBy: { createdAt: 'asc' },
    },
    _count: { select: { upvotes: true } },
  },
});
type AdminQuestionWithRelations = Prisma.QuestionGetPayload<typeof adminQuestionWithRelations>;

interface MyUpvotes {
  /** False for an anonymous caller — `upvotedByMe` must stay `undefined`, not `false`. */
  authenticated: boolean;
  questionIds: Set<string>;
  answerIds: Set<string>;
}

/** Invariant 6 — never stored, derived fresh from the row's *current* role. */
function isByStore(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF;
}

/** Invariant 7 — a soft-deleted author displays anonymously; email is never public either way. */
function toPublicAuthor(user: PublicUserRow): QnaAuthor {
  return { id: user.id, name: user.deletedAt ? null : user.name };
}

@Injectable()
export class QnaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
  ) {}

  async listForProduct(
    productId: string,
    query: PaginationQueryDto,
    callerUserId?: string,
  ): Promise<PaginatedResult<QuestionItem>> {
    const { page, pageSize } = query;
    const where: Prisma.QuestionWhereInput = { productId, isHidden: false };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        ...questionWithRelations,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);

    const myUpvotes = await this.myUpvotes(callerUserId, rows);
    const items = rows.map((row) => this.mapQuestion(row, myUpvotes));
    return { items, page, pageSize, total };
  }

  async askQuestion(productId: string, userId: string, dto: CreateQuestionDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.question.create({ data: { productId, userId, body: dto.body } });
  }

  async postAnswer(questionId: string, userId: string, dto: CreateAnswerDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    // No role branching here — Invariant 6 is entirely a read-time derivation.
    return this.prisma.answer.create({ data: { questionId, userId, body: dto.body } });
  }

  async upvoteQuestion(questionId: string, userId: string): Promise<void> {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    const existing = await this.prisma.questionUpvote.findUnique({
      where: { questionId_userId: { questionId, userId } },
    });
    if (existing) return;
    try {
      await this.prisma.questionUpvote.create({ data: { questionId, userId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Already upvoted');
      }
      throw error;
    }
  }

  async removeQuestionUpvote(questionId: string, userId: string): Promise<void> {
    const existing = await this.prisma.questionUpvote.findUnique({
      where: { questionId_userId: { questionId, userId } },
    });
    if (!existing) {
      throw new NotFoundException('You have not upvoted this question');
    }
    await this.prisma.questionUpvote.delete({ where: { id: existing.id } });
  }

  async upvoteAnswer(answerId: string, userId: string): Promise<void> {
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer) {
      throw new NotFoundException('Answer not found');
    }
    const existing = await this.prisma.answerUpvote.findUnique({
      where: { answerId_userId: { answerId, userId } },
    });
    if (existing) return;
    try {
      await this.prisma.answerUpvote.create({ data: { answerId, userId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Already upvoted');
      }
      throw error;
    }
  }

  async removeAnswerUpvote(answerId: string, userId: string): Promise<void> {
    const existing = await this.prisma.answerUpvote.findUnique({
      where: { answerId_userId: { answerId, userId } },
    });
    if (!existing) {
      throw new NotFoundException('You have not upvoted this answer');
    }
    await this.prisma.answerUpvote.delete({ where: { id: existing.id } });
  }

  async adminListQuestions(query: ListAdminQuestionsDto): Promise<PaginatedResult<AdminQuestionItem>> {
    const { page, pageSize, unanswered } = query;
    // No isHidden filter — the admin sees hidden content too, to moderate it.
    const where: Prisma.QuestionWhereInput = unanswered ? { answers: { none: {} } } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        ...adminQuestionWithRelations,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);

    const items = rows.map((row) => this.mapAdminQuestion(row));
    return { items, page, pageSize, total };
  }

  async adminModerateQuestion(id: string, hidden: boolean) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    // Deliberately does not touch any `answer` row — this is what makes both
    // the thread-hide cascade (the public read path filters on the question's
    // own isHidden first) and Invariant 4 (un-hiding doesn't restore
    // individually-hidden answers) true with no extra branching.
    return this.prisma.question.update({ where: { id }, data: { isHidden: hidden } });
  }

  async adminModerateAnswer(id: string, hidden: boolean) {
    const answer = await this.prisma.answer.findUnique({ where: { id } });
    if (!answer) {
      throw new NotFoundException('Answer not found');
    }
    return this.prisma.answer.update({ where: { id }, data: { isHidden: hidden } });
  }

  // ── Mapping ────────────────────────────────────────────────────────────

  private async myUpvotes(
    callerUserId: string | undefined,
    questions: QuestionWithRelations[],
  ): Promise<MyUpvotes> {
    if (!callerUserId) {
      return { authenticated: false, questionIds: new Set(), answerIds: new Set() };
    }
    const questionIds = questions.map((q) => q.id);
    const answerIds = questions.flatMap((q) => q.answers.map((a) => a.id));
    const [questionUpvotes, answerUpvotes] = await Promise.all([
      this.prisma.questionUpvote.findMany({
        where: { userId: callerUserId, questionId: { in: questionIds } },
        select: { questionId: true },
      }),
      this.prisma.answerUpvote.findMany({
        where: { userId: callerUserId, answerId: { in: answerIds } },
        select: { answerId: true },
      }),
    ]);
    return {
      authenticated: true,
      questionIds: new Set(questionUpvotes.map((u) => u.questionId)),
      answerIds: new Set(answerUpvotes.map((u) => u.answerId)),
    };
  }

  private mapQuestion(row: QuestionWithRelations, myUpvotes: MyUpvotes): QuestionItem {
    return {
      id: row.id,
      productId: row.productId,
      body: row.body,
      createdAt: row.createdAt,
      user: toPublicAuthor(row.user),
      upvoteCount: row._count.upvotes,
      upvotedByMe: myUpvotes.authenticated ? myUpvotes.questionIds.has(row.id) : undefined,
      answers: row.answers.map((answer) => this.mapAnswer(answer, myUpvotes)),
    };
  }

  private mapAnswer(row: AnswerWithUser, myUpvotes: MyUpvotes): AnswerItem {
    return {
      id: row.id,
      questionId: row.questionId,
      body: row.body,
      createdAt: row.createdAt,
      user: toPublicAuthor(row.user),
      upvoteCount: row._count.upvotes,
      upvotedByMe: myUpvotes.authenticated ? myUpvotes.answerIds.has(row.id) : undefined,
      isByStore: isByStore(row.user.role),
    };
  }

  private mapAdminQuestion(row: AdminQuestionWithRelations): AdminQuestionItem {
    const media = row.product.media[0];
    return {
      id: row.id,
      productId: row.productId,
      body: row.body,
      createdAt: row.createdAt,
      user: this.toAdminAuthor(row.user),
      upvoteCount: row._count.upvotes,
      isHidden: row.isHidden,
      product: {
        id: row.product.id,
        name: row.product.name,
        slug: row.product.slug,
        image: media ? this.storage.resolveUrl(media.storageRef) : null,
      },
      answers: row.answers.map((answer) => this.mapAdminAnswer(answer)),
    };
  }

  private mapAdminAnswer(row: AdminAnswerWithUser): AdminAnswerItem {
    return {
      id: row.id,
      questionId: row.questionId,
      body: row.body,
      createdAt: row.createdAt,
      user: this.toAdminAuthor(row.user),
      upvoteCount: row._count.upvotes,
      isByStore: isByStore(row.user.role),
      isHidden: row.isHidden,
    };
  }

  // Real name/email regardless of soft-delete — moderation needs to know who
  // wrote it, the same distinction FEAT-ADMIN-REVIEW-MODERATION §7 edge case
  // 3 already draws for Reviews (anonymization is a public display rule).
  private toAdminAuthor(user: AdminUserRow): { id: string; name: string | null; email: string } {
    return { id: user.id, name: user.name, email: user.email };
  }
}
