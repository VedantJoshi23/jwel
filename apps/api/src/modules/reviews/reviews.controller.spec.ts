import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('ReviewsController', () => {
  let service: {
    create: jest.Mock;
    listForProduct: jest.Mock;
    findMine: jest.Mock;
    adminListPending: jest.Mock;
    adminModerate: jest.Mock;
  };
  let controller: ReviewsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockReturnValue('created'),
      listForProduct: jest.fn().mockReturnValue('reviews'),
      findMine: jest.fn(),
      adminListPending: jest.fn().mockReturnValue('pending'),
      adminModerate: jest.fn().mockReturnValue('moderated'),
    };
    controller = new ReviewsController(service as unknown as ReviewsService);
  });

  it('create delegates with the current user id and dto', () => {
    const dto = { productId: 'p1', rating: 5 };
    expect(controller.create(user, dto as any)).toBe('created');
    expect(service.create).toHaveBeenCalledWith('u1', dto);
  });

  it('listForProduct delegates with productId and query', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.listForProduct('p1', query as any)).toBe('reviews');
    expect(service.listForProduct).toHaveBeenCalledWith('p1', query);
  });

  it('findMine returns the caller review, scoped by the bearer token and productId', async () => {
    service.findMine.mockResolvedValue({ id: 'r1', productId: 'p1', userId: 'u1', moderationStatus: 'PENDING' });
    const result = await controller.findMine(user, 'p1');
    expect(service.findMine).toHaveBeenCalledWith('u1', 'p1');
    expect(result).toMatchObject({ id: 'r1' });
  });

  it('findMine 404s rather than returning null — not-yet-reviewed is a normal state a frontend must distinguish from a failed request', async () => {
    service.findMine.mockResolvedValue(null);
    await expect(controller.findMine(user, 'p1')).rejects.toMatchObject({
      response: { message: 'You have not reviewed this product' },
    });
  });

  it('adminListPending delegates with the query', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.adminListPending(query as any)).toBe('pending');
  });

  it('adminModerate delegates with id and status', () => {
    expect(controller.adminModerate('r1', { status: 'APPROVED' } as any)).toBe('moderated');
    expect(service.adminModerate).toHaveBeenCalledWith('r1', 'APPROVED');
  });
});
