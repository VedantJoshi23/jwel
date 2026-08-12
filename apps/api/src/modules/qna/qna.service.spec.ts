import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { QnaService } from './qna.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { StorageProviderPort } from '../storage/ports/storage-provider.port';

type MockPrisma = {
  question: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  answer: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  questionUpvote: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; delete: jest.Mock };
  answerUpvote: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; delete: jest.Mock };
  product: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makeUser(overrides: Partial<{ id: string; name: string | null; deletedAt: Date | null; role: Role; email: string }> = {}) {
  return {
    id: 'u1',
    name: 'Priya',
    email: 'priya@example.com',
    deletedAt: null,
    role: Role.CUSTOMER,
    ...overrides,
  };
}

function makeQuestionRow(overrides: any = {}) {
  return {
    id: 'q1',
    productId: 'p1',
    body: 'Does this tarnish?',
    createdAt: new Date('2026-08-12'),
    user: makeUser(),
    answers: [],
    _count: { upvotes: 0 },
    ...overrides,
  };
}

describe('QnaService', () => {
  let prisma: MockPrisma;
  let storage: { resolveUrl: jest.Mock };
  let service: QnaService;

  beforeEach(() => {
    prisma = {
      question: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      answer: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      questionUpvote: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
      answerUpvote: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    storage = { resolveUrl: jest.fn((ref: string) => `https://cdn.example.com/${ref}`) };
    service = new QnaService(prisma as unknown as PrismaService, storage as unknown as StorageProviderPort);
  });

  describe('listForProduct', () => {
    it('filters to isHidden: false questions', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      prisma.question.count.mockResolvedValue(0);
      await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({ productId: 'p1', isHidden: false });
    });

    it('also filters each question\'s nested answers to isHidden: false', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      prisma.question.count.mockResolvedValue(0);
      await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(prisma.question.findMany.mock.calls[0][0].include.answers.where).toEqual({ isHidden: false });
    });

    it('maps upvote counts from _count', async () => {
      prisma.question.findMany.mockResolvedValue([makeQuestionRow({ _count: { upvotes: 5 } })]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(result.items[0].upvoteCount).toBe(5);
    });

    it('leaves upvotedByMe undefined for an anonymous caller, not false', async () => {
      prisma.question.findMany.mockResolvedValue([makeQuestionRow()]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(result.items[0].upvotedByMe).toBeUndefined();
    });

    it('sets upvotedByMe: false for a logged-in caller with zero upvotes among the results — not undefined', async () => {
      prisma.question.findMany.mockResolvedValue([makeQuestionRow()]);
      prisma.question.count.mockResolvedValue(1);
      prisma.questionUpvote.findMany.mockResolvedValue([]);
      prisma.answerUpvote.findMany.mockResolvedValue([]);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 }, 'caller1');
      expect(result.items[0].upvotedByMe).toBe(false);
    });

    it('sets upvotedByMe: true when the caller has upvoted that question', async () => {
      prisma.question.findMany.mockResolvedValue([makeQuestionRow({ id: 'q1' })]);
      prisma.question.count.mockResolvedValue(1);
      prisma.questionUpvote.findMany.mockResolvedValue([{ questionId: 'q1' }]);
      prisma.answerUpvote.findMany.mockResolvedValue([]);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 }, 'caller1');
      expect(result.items[0].upvotedByMe).toBe(true);
    });

    it('anonymizes a soft-deleted author — name becomes null (Invariant 7)', async () => {
      prisma.question.findMany.mockResolvedValue([
        makeQuestionRow({ user: makeUser({ deletedAt: new Date('2026-01-01') }) }),
      ]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(result.items[0].user.name).toBeNull();
    });

    it('sets upvotedByMe: true on an answer when the caller has upvoted it', async () => {
      prisma.question.findMany.mockResolvedValue([
        makeQuestionRow({
          answers: [
            { id: 'a1', questionId: 'q1', body: 'Yes', createdAt: new Date(), user: makeUser(), _count: { upvotes: 0 } },
          ],
        }),
      ]);
      prisma.question.count.mockResolvedValue(1);
      prisma.questionUpvote.findMany.mockResolvedValue([]);
      prisma.answerUpvote.findMany.mockResolvedValue([{ answerId: 'a1' }]);
      const result = await service.listForProduct('p1', { page: 1, pageSize: 10 }, 'caller1');
      expect(result.items[0].answers[0].upvotedByMe).toBe(true);
    });

    it('derives isByStore from an answer\'s current role, ADMIN and STAFF both true', async () => {
      const answer = (role: Role) => ({
        id: 'a1',
        questionId: 'q1',
        body: 'Yes',
        createdAt: new Date(),
        user: makeUser({ role }),
        _count: { upvotes: 0 },
      });
      prisma.question.findMany.mockResolvedValue([makeQuestionRow({ answers: [answer(Role.ADMIN)] })]);
      prisma.question.count.mockResolvedValue(1);
      const admin = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(admin.items[0].answers[0].isByStore).toBe(true);

      prisma.question.findMany.mockResolvedValue([makeQuestionRow({ answers: [answer(Role.STAFF)] })]);
      const staff = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(staff.items[0].answers[0].isByStore).toBe(true);

      prisma.question.findMany.mockResolvedValue([makeQuestionRow({ answers: [answer(Role.CUSTOMER)] })]);
      const customer = await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(customer.items[0].answers[0].isByStore).toBe(false);
    });
  });

  describe('askQuestion', () => {
    it('404s when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.askQuestion('nope', 'u1', { body: 'x' } as any)).rejects.toThrow(NotFoundException);
      expect(prisma.question.create).not.toHaveBeenCalled();
    });

    it('creates the question tied to the product and asker', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.question.create.mockResolvedValue({ id: 'q1' });
      await service.askQuestion('p1', 'u1', { body: 'Does this tarnish?' } as any);
      expect(prisma.question.create).toHaveBeenCalledWith({
        data: { productId: 'p1', userId: 'u1', body: 'Does this tarnish?' },
      });
    });
  });

  describe('postAnswer', () => {
    it('404s when the question does not exist', async () => {
      prisma.question.findUnique.mockResolvedValue(null);
      await expect(service.postAnswer('nope', 'u1', { body: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('creates the answer with no role branching — same call shape for any caller', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.answer.create.mockResolvedValue({ id: 'a1' });
      await service.postAnswer('q1', 'admin1', { body: 'Yes, plated in rhodium.' } as any);
      expect(prisma.answer.create).toHaveBeenCalledWith({
        data: { questionId: 'q1', userId: 'admin1', body: 'Yes, plated in rhodium.' },
      });
    });
  });

  describe('upvoteQuestion / removeQuestionUpvote', () => {
    it('404s upvoting an unknown question', async () => {
      prisma.question.findUnique.mockResolvedValue(null);
      await expect(service.upvoteQuestion('nope', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('is a no-op when already upvoted, not a duplicate create', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.questionUpvote.findUnique.mockResolvedValue({ id: 'up1' });
      await service.upvoteQuestion('q1', 'u1');
      expect(prisma.questionUpvote.create).not.toHaveBeenCalled();
    });

    it('creates the upvote when not already present', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.questionUpvote.findUnique.mockResolvedValue(null);
      await service.upvoteQuestion('q1', 'u1');
      expect(prisma.questionUpvote.create).toHaveBeenCalledWith({ data: { questionId: 'q1', userId: 'u1' } });
    });

    it('turns a P2002 race into a clean 409, not a raw Prisma error', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.questionUpvote.findUnique.mockResolvedValue(null);
      prisma.questionUpvote.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.upvoteQuestion('q1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('re-throws a non-P2002 error unchanged', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.questionUpvote.findUnique.mockResolvedValue(null);
      prisma.questionUpvote.create.mockRejectedValue({ code: 'P9999', message: 'db exploded' });
      await expect(service.upvoteQuestion('q1', 'u1')).rejects.toMatchObject({ code: 'P9999' });
    });

    it('404s removing an upvote that does not exist', async () => {
      prisma.questionUpvote.findUnique.mockResolvedValue(null);
      await expect(service.removeQuestionUpvote('q1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('deletes the upvote row when present', async () => {
      prisma.questionUpvote.findUnique.mockResolvedValue({ id: 'up1' });
      await service.removeQuestionUpvote('q1', 'u1');
      expect(prisma.questionUpvote.delete).toHaveBeenCalledWith({ where: { id: 'up1' } });
    });
  });

  describe('upvoteAnswer / removeAnswerUpvote', () => {
    it('404s upvoting an unknown answer', async () => {
      prisma.answer.findUnique.mockResolvedValue(null);
      await expect(service.upvoteAnswer('nope', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('creates the upvote when not already present', async () => {
      prisma.answer.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.answerUpvote.findUnique.mockResolvedValue(null);
      await service.upvoteAnswer('a1', 'u1');
      expect(prisma.answerUpvote.create).toHaveBeenCalledWith({ data: { answerId: 'a1', userId: 'u1' } });
    });

    it('is a no-op when already upvoted, not a duplicate create', async () => {
      prisma.answer.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.answerUpvote.findUnique.mockResolvedValue({ id: 'up1' });
      await service.upvoteAnswer('a1', 'u1');
      expect(prisma.answerUpvote.create).not.toHaveBeenCalled();
    });

    it('turns a P2002 race into a clean 409', async () => {
      prisma.answer.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.answerUpvote.findUnique.mockResolvedValue(null);
      prisma.answerUpvote.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.upvoteAnswer('a1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('re-throws a non-P2002 error unchanged', async () => {
      prisma.answer.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.answerUpvote.findUnique.mockResolvedValue(null);
      prisma.answerUpvote.create.mockRejectedValue({ code: 'P9999' });
      await expect(service.upvoteAnswer('a1', 'u1')).rejects.toMatchObject({ code: 'P9999' });
    });

    it('404s removing an upvote that does not exist', async () => {
      prisma.answerUpvote.findUnique.mockResolvedValue(null);
      await expect(service.removeAnswerUpvote('a1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('deletes the answer upvote row when present', async () => {
      prisma.answerUpvote.findUnique.mockResolvedValue({ id: 'up1' });
      await service.removeAnswerUpvote('a1', 'u1');
      expect(prisma.answerUpvote.delete).toHaveBeenCalledWith({ where: { id: 'up1' } });
    });
  });

  describe('adminListQuestions', () => {
    it('applies no isHidden filter by default — admin sees hidden content to moderate it', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      prisma.question.count.mockResolvedValue(0);
      await service.adminListQuestions({ page: 1, pageSize: 20 } as any);
      expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('unanswered: true filters to questions with zero answers', async () => {
      prisma.question.findMany.mockResolvedValue([]);
      prisma.question.count.mockResolvedValue(0);
      await service.adminListQuestions({ page: 1, pageSize: 20, unanswered: true } as any);
      expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({ answers: { none: {} } });
    });

    it('includes product name/slug/image and reviewer email, not raw FK columns', async () => {
      prisma.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          productId: 'p1',
          body: 'x',
          createdAt: new Date(),
          isHidden: false,
          user: makeUser({ email: 'admin-asker@example.com' }),
          product: { id: 'p1', name: 'Diamond Ring', slug: 'diamond-ring', media: [{ storageRef: 'local:products/x.jpg' }] },
          answers: [],
          _count: { upvotes: 0 },
        },
      ]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.adminListQuestions({ page: 1, pageSize: 20 } as any);
      expect(result.items[0]).toMatchObject({
        product: { name: 'Diamond Ring', slug: 'diamond-ring', image: 'https://cdn.example.com/local:products/x.jpg' },
        user: { email: 'admin-asker@example.com' },
      });
    });

    it('shows the real name/email of a soft-deleted author — moderation is not the anonymous-display rule', async () => {
      prisma.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          productId: 'p1',
          body: 'x',
          createdAt: new Date(),
          isHidden: false,
          user: makeUser({ deletedAt: new Date('2026-01-01'), name: 'Deleted Person', email: 'gone@example.com' }),
          product: { id: 'p1', name: 'Ring', slug: 'ring', media: [] },
          answers: [],
          _count: { upvotes: 0 },
        },
      ]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.adminListQuestions({ page: 1, pageSize: 20 } as any);
      expect(result.items[0].user).toMatchObject({ name: 'Deleted Person', email: 'gone@example.com' });
    });

    it('includes each answer\'s own hidden state, upvote count, and store badge', async () => {
      prisma.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          productId: 'p1',
          body: 'x',
          createdAt: new Date(),
          isHidden: false,
          user: makeUser(),
          product: { id: 'p1', name: 'Ring', slug: 'ring', media: [] },
          answers: [
            {
              id: 'a1',
              questionId: 'q1',
              body: 'Yes',
              createdAt: new Date(),
              isHidden: true,
              user: makeUser({ role: Role.ADMIN }),
              _count: { upvotes: 3 },
            },
          ],
          _count: { upvotes: 0 },
        },
      ]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.adminListQuestions({ page: 1, pageSize: 20 } as any);
      expect(result.items[0].answers[0]).toMatchObject({
        id: 'a1',
        isHidden: true,
        isByStore: true,
        upvoteCount: 3,
      });
    });

    it('image is null when the product has no media', async () => {
      prisma.question.findMany.mockResolvedValue([
        {
          id: 'q1',
          productId: 'p1',
          body: 'x',
          createdAt: new Date(),
          isHidden: false,
          user: makeUser(),
          product: { id: 'p1', name: 'Ring', slug: 'ring', media: [] },
          answers: [],
          _count: { upvotes: 0 },
        },
      ]);
      prisma.question.count.mockResolvedValue(1);
      const result = await service.adminListQuestions({ page: 1, pageSize: 20 } as any);
      expect(result.items[0].product.image).toBeNull();
    });
  });

  describe('adminModerateQuestion', () => {
    it('404s on an unknown question', async () => {
      prisma.question.findUnique.mockResolvedValue(null);
      await expect(service.adminModerateQuestion('nope', true)).rejects.toThrow(NotFoundException);
    });

    it('sets isHidden and never touches any answer row (Invariant 3/4)', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.question.update.mockResolvedValue({ id: 'q1', isHidden: true });
      await service.adminModerateQuestion('q1', true);
      expect(prisma.question.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { isHidden: true } });
      expect(prisma.answer.update).not.toHaveBeenCalled();
    });

    it('un-hides by setting isHidden: false', async () => {
      prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
      prisma.question.update.mockResolvedValue({ id: 'q1', isHidden: false });
      await service.adminModerateQuestion('q1', false);
      expect(prisma.question.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { isHidden: false } });
    });
  });

  describe('adminModerateAnswer', () => {
    it('404s on an unknown answer', async () => {
      prisma.answer.findUnique.mockResolvedValue(null);
      await expect(service.adminModerateAnswer('nope', true)).rejects.toThrow(NotFoundException);
    });

    it('sets isHidden on that single answer only, never the parent question', async () => {
      prisma.answer.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.answer.update.mockResolvedValue({ id: 'a1', isHidden: true });
      await service.adminModerateAnswer('a1', true);
      expect(prisma.answer.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { isHidden: true } });
      expect(prisma.question.update).not.toHaveBeenCalled();
    });
  });
});
