import { Prisma, SizeScheme } from '@prisma/client';
import { SizesService } from './sizes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SizesService', () => {
  const row = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'id-1',
    scheme: SizeScheme.RING_INDIA,
    value: '16',
    label: '16',
    diameterMm: new Prisma.Decimal('17.93'),
    circumferenceMm: new Prisma.Decimal('56.30'),
    usEquivalent: '8',
    ukEquivalent: 'P½',
    sortOrder: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const makeService = (rows: ReturnType<typeof row>[]) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = { sizeOption: { findMany } } as unknown as PrismaService;
    return { service: new SizesService(prisma), findMany };
  };

  it('serialises Decimal measurements as strings, not JSON numbers', async () => {
    // A JSON number would lose the fixed scale — 56.30 becomes 56.3 — and the
    // size guide displays these verbatim.
    const { service } = makeService([row()]);
    const [option] = await service.findAll();

    expect(option.circumferenceMm).toBe('56.3');
    expect(typeof option.circumferenceMm).toBe('string');
    expect(option.diameterMm).toBe('17.93');
  });

  it('returns null diameter for length schemes rather than omitting the field', async () => {
    const { service } = makeService([
      row({ scheme: SizeScheme.CHAIN_LENGTH_MM, value: '450', diameterMm: null }),
    ]);
    const [option] = await service.findAll();

    expect(option.diameterMm).toBeNull();
    expect(option.circumferenceMm).toBe('56.3');
  });

  it('filters by scheme when one is given', async () => {
    const { service, findMany } = makeService([row()]);
    await service.findAll(SizeScheme.RING_INDIA);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheme: SizeScheme.RING_INDIA } }),
    );
  });

  it('returns every scheme when none is given', async () => {
    const { service, findMany } = makeService([row()]);
    await service.findAll();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('orders by scheme then display order, so the guide reads correctly', async () => {
    const { service, findMany } = makeService([row()]);
    await service.findAll();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scheme: 'asc' }, { sortOrder: 'asc' }],
      }),
    );
  });

  describe('valuesFor', () => {
    it('returns a Set of canonical values for validation', async () => {
      const findMany = jest.fn().mockResolvedValue([{ value: '6' }, { value: '16' }]);
      const prisma = { sizeOption: { findMany } } as unknown as PrismaService;
      const service = new SizesService(prisma);

      const values = await service.valuesFor(SizeScheme.RING_INDIA);

      expect(values.has('16')).toBe(true);
      expect(values.has('30')).toBe(false);
      expect(values.size).toBe(2);
    });

    it('returns an empty Set for a scheme with no seeded rows', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { sizeOption: { findMany } } as unknown as PrismaService;
      const service = new SizesService(prisma);

      await expect(service.valuesFor(SizeScheme.BANGLE_INDIA)).resolves.toEqual(new Set());
    });
  });
});
