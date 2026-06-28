import { BadRequestException } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

type MockPrisma = { category: { findUnique: jest.Mock } };
type MockProducts = { adminCreate: jest.Mock };

const VALID_ROW =
  'name,slug,category_slug,description,certification_type,certification_doc_ref,sku,metal,purity,size,weight_grams,base_price_minor_units';

function csv(...rows: string[]): Buffer {
  return Buffer.from([VALID_ROW, ...rows].join('\n'), 'utf-8');
}

describe('BulkImportService', () => {
  let prisma: MockPrisma;
  let products: MockProducts;
  let service: BulkImportService;

  beforeEach(() => {
    prisma = { category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', slug: 'rings' }) } };
    products = { adminCreate: jest.fn().mockResolvedValue({ id: 'p1' }) };
    service = new BulkImportService(prisma as unknown as PrismaService, products as unknown as ProductsService);
  });

  it('throws BadRequestException for an empty CSV', async () => {
    await expect(service.importProductsCsv(Buffer.from(''))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when required columns are missing from the header', async () => {
    const badCsv = Buffer.from('name,slug\nFoo,foo', 'utf-8');
    await expect(service.importProductsCsv(badCsv)).rejects.toThrow(BadRequestException);
  });

  it('imports a single valid row successfully, mapping fields to CreateProductDto correctly', async () => {
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,A ring,BIS_HALLMARK,,RNG-01,GOLD,18K,7,1.5,250000'),
    );
    expect(result).toEqual({ totalRows: 1, succeeded: 1, failed: 0, errors: [] });
    expect(products.adminCreate).toHaveBeenCalledWith({
      name: 'Gold Ring',
      slug: 'gold-ring',
      categoryId: 'cat-1',
      description: 'A ring',
      certificationType: 'BIS_HALLMARK',
      certificationDocRef: undefined,
      variants: [{ sku: 'RNG-01', metal: 'GOLD', purity: '18K', size: '7', weightGrams: 1.5, basePriceMinorUnits: 250000 }],
    });
  });

  it('correctly parses a quoted field containing an embedded comma', async () => {
    await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,"A ring, lightweight and durable",,,RNG-01,GOLD,,,1.5,250000'),
    );
    expect(products.adminCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'A ring, lightweight and durable' }),
    );
  });

  it('reports a row-level error (not a thrown exception) for an unknown category slug, and still totals correctly', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,nonexistent,A ring,,,RNG-01,GOLD,,,1.5,250000'),
    );
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, message: expect.stringContaining('nonexistent') });
    expect(products.adminCreate).not.toHaveBeenCalled();
  });

  it('reports a row-level error for an invalid metal value', async () => {
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,A ring,,,RNG-01,UNOBTAINIUM,,,1.5,250000'),
    );
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('Invalid metal');
  });

  it('reports a row-level error for an invalid certification_type value', async () => {
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,A ring,NOT_REAL,,RNG-01,GOLD,,,1.5,250000'),
    );
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('certification_type');
  });

  it('reports a row-level error for a non-numeric weight_grams', async () => {
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,A ring,,,RNG-01,GOLD,,,not-a-number,250000'),
    );
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('weight_grams');
  });

  it('reports a row-level error for a non-integer base_price_minor_units', async () => {
    const result = await service.importProductsCsv(
      csv('Gold Ring,gold-ring,rings,A ring,,,RNG-01,GOLD,,,1.5,99.5'),
    );
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('base_price_minor_units');
  });

  it('reports a row-level error when a required column value is blank', async () => {
    const result = await service.importProductsCsv(csv(',gold-ring,rings,A ring,,,RNG-01,GOLD,,,1.5,250000'));
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('name');
  });

  it('processes multiple rows independently — one bad row does not abort the rest', async () => {
    const result = await service.importProductsCsv(
      csv(
        'Gold Ring,gold-ring,rings,A ring,,,RNG-01,GOLD,,,1.5,250000',
        'Bad Row,bad-row,rings,Bad,,,RNG-02,NOTAMETAL,,,1.5,250000',
        'Silver Chain,silver-chain,rings,A chain,,,CHN-01,SILVER,,,5,80000',
      ),
    );
    expect(result.totalRows).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // the bad row is the 2nd data row -> spreadsheet row 3
  });

  it('only looks up a given category slug once across multiple rows that share it', async () => {
    await service.importProductsCsv(
      csv(
        'Ring One,ring-one,rings,d,,,R1,GOLD,,,1,1000',
        'Ring Two,ring-two,rings,d,,,R2,GOLD,,,1,1000',
      ),
    );
    expect(prisma.category.findUnique).toHaveBeenCalledTimes(1);
  });
});
