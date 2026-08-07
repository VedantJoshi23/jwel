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
    isCustom: false,
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

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('excludes custom options when curatedOnly is set', async () => {
    // The admin creation form passes this. Offering a custom value there would
    // let the free-text vocabulary this feature replaces creep back in one
    // product at a time (FEAT-SIZE-TAXONOMY criterion 10).
    const { service, findMany } = makeService([row()]);
    await service.findAll(SizeScheme.RING_INDIA, true);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheme: SizeScheme.RING_INDIA, isCustom: false } }),
    );
  });

  it('includes custom options by default, so filters and guides show them', async () => {
    const { service, findMany } = makeService([row()]);
    await service.findAll(SizeScheme.RING_INDIA);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheme: SizeScheme.RING_INDIA } }),
    );
  });

  it('serialises a custom option with no circumference as null', async () => {
    // "Free size" has no measurement, and inventing one to fill the column
    // would be exactly the fabrication Law 1 forbids.
    const { service } = makeService([
      row({ value: 'Free size', label: 'Free size', circumferenceMm: null, diameterMm: null, isCustom: true }),
    ]);
    const [option] = await service.findAll();

    expect(option.circumferenceMm).toBeNull();
    expect(option.isCustom).toBe(true);
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
    it('includes custom values, so a legacy product survives an edit', async () => {
      // What stops new drift is the admin form not *offering* custom values,
      // not the validator refusing them — refusing would make every legacy
      // product unsaveable.
      const findMany = jest.fn().mockResolvedValue([{ value: '16' }, { value: '16.5' }]);
      const prisma = { sizeOption: { findMany } } as unknown as PrismaService;
      const service = new SizesService(prisma);

      const values = await service.valuesFor(SizeScheme.RING_INDIA);

      expect(values.has('16.5')).toBe(true);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scheme: SizeScheme.RING_INDIA } }),
      );
    });

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
