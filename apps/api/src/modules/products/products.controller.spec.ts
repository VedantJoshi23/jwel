import { BadRequestException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BulkImportService } from './bulk-import.service';

describe('ProductsController', () => {
  let products: {
    findAll: jest.Mock;
    findBySlug: jest.Mock;
    adminFindAll: jest.Mock;
    adminFindOne: jest.Mock;
    adminCreate: jest.Mock;
    adminUpdate: jest.Mock;
    adminDelete: jest.Mock;
  };
  let bulkImport: { importProductsCsv: jest.Mock };
  let controller: ProductsController;

  beforeEach(() => {
    products = {
      findAll: jest.fn().mockReturnValue('public-list'),
      findBySlug: jest.fn().mockReturnValue('product'),
      adminFindAll: jest.fn().mockReturnValue('admin-list'),
      adminFindOne: jest.fn().mockReturnValue('admin-product'),
      adminCreate: jest.fn().mockReturnValue('created'),
      adminUpdate: jest.fn().mockReturnValue('updated'),
      adminDelete: jest.fn().mockReturnValue('deleted'),
    };
    bulkImport = { importProductsCsv: jest.fn().mockResolvedValue('import-result') };
    controller = new ProductsController(products as unknown as ProductsService, bulkImport as unknown as BulkImportService);
  });

  it('findAll delegates with the query', () => {
    const query = { page: 1 };
    expect(controller.findAll(query as any)).toBe('public-list');
    expect(products.findAll).toHaveBeenCalledWith(query);
  });

  it('findBySlug delegates with the slug', () => {
    expect(controller.findBySlug('gold-ring')).toBe('product');
    expect(products.findBySlug).toHaveBeenCalledWith('gold-ring');
  });

  it('adminFindAll delegates with the query', () => {
    const query = { page: 1 };
    expect(controller.adminFindAll(query as any)).toBe('admin-list');
    expect(products.adminFindAll).toHaveBeenCalledWith(query);
  });

  it('adminFindOne delegates with the id', () => {
    expect(controller.adminFindOne('p1')).toBe('admin-product');
  });

  it('adminCreate delegates with the dto', () => {
    const dto = { name: 'x' };
    expect(controller.adminCreate(dto as any)).toBe('created');
    expect(products.adminCreate).toHaveBeenCalledWith(dto);
  });

  it('adminUpdate delegates with id and dto', () => {
    const dto = { status: 'PUBLISHED' };
    expect(controller.adminUpdate('p1', dto as any)).toBe('updated');
    expect(products.adminUpdate).toHaveBeenCalledWith('p1', dto);
  });

  it('adminDelete delegates with the id', () => {
    expect(controller.adminDelete('p1')).toBe('deleted');
  });

  describe('bulkImport', () => {
    it('throws BadRequestException when no file is uploaded', async () => {
      await expect(controller.bulkImport(undefined)).rejects.toThrow(BadRequestException);
    });

    it('delegates the file buffer to BulkImportService', async () => {
      const file = { buffer: Buffer.from('csv,data') } as any;
      expect(await controller.bulkImport(file)).toBe('import-result');
      expect(bulkImport.importProductsCsv).toHaveBeenCalledWith(file.buffer);
    });
  });
});
