import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let service: { list: jest.Mock };
  let controller: AuditLogController;

  beforeEach(() => {
    service = { list: jest.fn().mockReturnValue('entries') };
    controller = new AuditLogController(service as unknown as AuditLogService);
  });

  it('delegates with the filters split out of the query and the whole query for pagination', () => {
    const query = { page: 1, pageSize: 20, entityType: 'Order', entityId: 'o1', actorId: 'admin-1' };
    expect(controller.list(query as any)).toBe('entries');
    expect(service.list).toHaveBeenCalledWith({ entityType: 'Order', entityId: 'o1', actorId: 'admin-1' }, query);
  });

  it('delegates with undefined filters when none are given', () => {
    const query = { page: 1, pageSize: 20 };
    expect(controller.list(query as any)).toBe('entries');
    expect(service.list).toHaveBeenCalledWith({ entityType: undefined, entityId: undefined, actorId: undefined }, query);
  });
});
