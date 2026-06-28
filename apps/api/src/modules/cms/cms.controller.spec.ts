import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

describe('CmsController', () => {
  let service: {
    listActiveBanners: jest.Mock;
    adminListBanners: jest.Mock;
    adminCreateBanner: jest.Mock;
    adminUpdateBanner: jest.Mock;
    adminDeleteBanner: jest.Mock;
  };
  let controller: CmsController;

  beforeEach(() => {
    service = {
      listActiveBanners: jest.fn().mockReturnValue('active'),
      adminListBanners: jest.fn().mockReturnValue('all'),
      adminCreateBanner: jest.fn().mockReturnValue('created'),
      adminUpdateBanner: jest.fn().mockReturnValue('updated'),
      adminDeleteBanner: jest.fn().mockReturnValue('deleted'),
    };
    controller = new CmsController(service as unknown as CmsService);
  });

  it('listActiveBanners delegates with no args', () => {
    expect(controller.listActiveBanners()).toBe('active');
  });

  it('adminListBanners delegates with no args', () => {
    expect(controller.adminListBanners()).toBe('all');
  });

  it('adminCreateBanner delegates with the dto', () => {
    const dto = { title: 'T', imageRef: 'x.jpg' };
    expect(controller.adminCreateBanner(dto as any)).toBe('created');
    expect(service.adminCreateBanner).toHaveBeenCalledWith(dto);
  });

  it('adminUpdateBanner delegates with id and dto', () => {
    const dto = { title: 'T', imageRef: 'x.jpg' };
    expect(controller.adminUpdateBanner('b1', dto as any)).toBe('updated');
    expect(service.adminUpdateBanner).toHaveBeenCalledWith('b1', dto);
  });

  it('adminDeleteBanner delegates with id', () => {
    expect(controller.adminDeleteBanner('b1')).toBe('deleted');
    expect(service.adminDeleteBanner).toHaveBeenCalledWith('b1');
  });
});
