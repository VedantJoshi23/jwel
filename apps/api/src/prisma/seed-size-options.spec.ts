import { SizeScheme } from '@prisma/client';
import { seedSizeOptions } from './seed-size-options';
import { SIZE_OPTION_SEED } from './size-options.data';

type MockPrisma = {
  sizeOption: { upsert: jest.Mock; deleteMany: jest.Mock };
};

describe('seedSizeOptions', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      sizeOption: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
  });

  it('upserts every row in SIZE_OPTION_SEED', async () => {
    await seedSizeOptions(prisma as any);
    expect(prisma.sizeOption.upsert).toHaveBeenCalledTimes(SIZE_OPTION_SEED.length);
  });

  it('prunes curated rows for a seeded scheme that are no longer in the list — narrowing a range actually narrows it', async () => {
    await seedSizeOptions(prisma as any);

    const ringPrune = prisma.sizeOption.deleteMany.mock.calls.find(
      ([args]) => args.where.scheme === SizeScheme.RING_INDIA,
    );
    expect(ringPrune).toBeDefined();
    const [{ where }] = ringPrune!;
    expect(where.isCustom).toBe(false);
    // Never prunes a value that's actually still in the current seed.
    expect(where.value.notIn).toEqual(expect.arrayContaining(['10', '11', '12', '13', '14', '15']));
  });

  it('never touches a custom (isCustom: true) row, even one with a value outside the current range', async () => {
    await seedSizeOptions(prisma as any);
    for (const [{ where }] of prisma.sizeOption.deleteMany.mock.calls) {
      expect(where.isCustom).toBe(false);
    }
  });

  it('prunes once per distinct scheme in the seed, not once per row', async () => {
    await seedSizeOptions(prisma as any);
    const distinctSchemes = new Set(SIZE_OPTION_SEED.map((o) => o.scheme));
    expect(prisma.sizeOption.deleteMany).toHaveBeenCalledTimes(distinctSchemes.size);
  });
});
