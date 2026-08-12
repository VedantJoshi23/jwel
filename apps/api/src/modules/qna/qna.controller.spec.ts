import { QnaController } from './qna.controller';
import { QnaService } from './qna.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('QnaController', () => {
  let service: {
    listForProduct: jest.Mock;
    askQuestion: jest.Mock;
    postAnswer: jest.Mock;
    upvoteQuestion: jest.Mock;
    removeQuestionUpvote: jest.Mock;
    upvoteAnswer: jest.Mock;
    removeAnswerUpvote: jest.Mock;
    adminListQuestions: jest.Mock;
    adminModerateQuestion: jest.Mock;
    adminModerateAnswer: jest.Mock;
  };
  let controller: QnaController;

  beforeEach(() => {
    service = {
      listForProduct: jest.fn().mockReturnValue('questions'),
      askQuestion: jest.fn().mockReturnValue('asked'),
      postAnswer: jest.fn().mockReturnValue('answered'),
      upvoteQuestion: jest.fn().mockReturnValue('upvoted-q'),
      removeQuestionUpvote: jest.fn().mockReturnValue('removed-q'),
      upvoteAnswer: jest.fn().mockReturnValue('upvoted-a'),
      removeAnswerUpvote: jest.fn().mockReturnValue('removed-a'),
      adminListQuestions: jest.fn().mockReturnValue('admin-list'),
      adminModerateQuestion: jest.fn().mockReturnValue('moderated-q'),
      adminModerateAnswer: jest.fn().mockReturnValue('moderated-a'),
    };
    controller = new QnaController(service as unknown as QnaService);
  });

  it('listForProduct delegates with productId, query, and the caller id when present', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.listForProduct('p1', query as any, user)).toBe('questions');
    expect(service.listForProduct).toHaveBeenCalledWith('p1', query, 'u1');
  });

  it('listForProduct passes undefined for an anonymous caller, not throwing on a null user', () => {
    const query = { page: 1, pageSize: 10 };
    controller.listForProduct('p1', query as any, null);
    expect(service.listForProduct).toHaveBeenCalledWith('p1', query, undefined);
  });

  it('askQuestion delegates with productId, caller id, and dto', () => {
    const dto = { body: 'Does this tarnish?' };
    expect(controller.askQuestion('p1', user, dto as any)).toBe('asked');
    expect(service.askQuestion).toHaveBeenCalledWith('p1', 'u1', dto);
  });

  it('postAnswer delegates with questionId, caller id, and dto — same route regardless of role', () => {
    const dto = { body: 'Yes, rhodium-plated.' };
    expect(controller.postAnswer('q1', user, dto as any)).toBe('answered');
    expect(service.postAnswer).toHaveBeenCalledWith('q1', 'u1', dto);
  });

  it('upvoteQuestion / removeQuestionUpvote delegate with questionId and caller id', () => {
    expect(controller.upvoteQuestion('q1', user)).toBe('upvoted-q');
    expect(service.upvoteQuestion).toHaveBeenCalledWith('q1', 'u1');
    expect(controller.removeQuestionUpvote('q1', user)).toBe('removed-q');
    expect(service.removeQuestionUpvote).toHaveBeenCalledWith('q1', 'u1');
  });

  it('upvoteAnswer / removeAnswerUpvote delegate with answerId and caller id', () => {
    expect(controller.upvoteAnswer('a1', user)).toBe('upvoted-a');
    expect(service.upvoteAnswer).toHaveBeenCalledWith('a1', 'u1');
    expect(controller.removeAnswerUpvote('a1', user)).toBe('removed-a');
    expect(service.removeAnswerUpvote).toHaveBeenCalledWith('a1', 'u1');
  });

  it('adminListQuestions delegates with the query', () => {
    const query = { page: 1, pageSize: 20, unanswered: true };
    expect(controller.adminListQuestions(query as any)).toBe('admin-list');
    expect(service.adminListQuestions).toHaveBeenCalledWith(query);
  });

  it('adminModerateQuestion delegates with id and hidden', () => {
    expect(controller.adminModerateQuestion('q1', { hidden: true } as any)).toBe('moderated-q');
    expect(service.adminModerateQuestion).toHaveBeenCalledWith('q1', true);
  });

  it('adminModerateAnswer delegates with id and hidden', () => {
    expect(controller.adminModerateAnswer('a1', { hidden: false } as any)).toBe('moderated-a');
    expect(service.adminModerateAnswer).toHaveBeenCalledWith('a1', false);
  });
});
