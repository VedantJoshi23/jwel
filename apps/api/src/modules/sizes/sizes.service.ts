import { Injectable } from '@nestjs/common';
import { SizeScheme } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SizeOptionResponse {
  scheme: SizeScheme;
  value: string;
  label: string;
  /**
   * Authoritative physical measure. Published Indian ring charts agree on
   * circumference but differ by ~0.2mm on diameter — see
   * FEAT-SIZE-TAXONOMY §6. Serialised as a string because it is a
   * Prisma Decimal; JSON numbers would lose the fixed scale.
   */
  circumferenceMm: string | null;
  /**
   * True for values recovered from legacy free-text data. Real and
   * filterable, but never offered when creating a new product — see
   * FEAT-SIZE-TAXONOMY criterion 10.
   */
  isCustom: boolean;
  diameterMm: string | null;
  usEquivalent: string | null;
  ukEquivalent: string | null;
}

/**
 * FEAT-SIZE-TAXONOMY — read-only access to the seeded size vocabulary.
 *
 * There is no write path. Sizes are reference data seeded by
 * `seed-size-options.ts`; letting an admin invent one at runtime is exactly
 * how the free-text vocabulary this feature replaces came about.
 */
@Injectable()
export class SizesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param curatedOnly excludes custom options. The admin creation form passes
   *   true — offering a custom value there would let the free-text vocabulary
   *   this feature replaces creep back in one product at a time.
   */
  async findAll(scheme?: SizeScheme, curatedOnly = false): Promise<SizeOptionResponse[]> {
    const options = await this.prisma.sizeOption.findMany({
      where: {
        ...(scheme ? { scheme } : {}),
        ...(curatedOnly ? { isCustom: false } : {}),
      },
      orderBy: [{ scheme: 'asc' }, { sortOrder: 'asc' }],
    });

    return options.map((option) => ({
      scheme: option.scheme,
      value: option.value,
      label: option.label,
      circumferenceMm: option.circumferenceMm?.toString() ?? null,
      isCustom: option.isCustom,
      diameterMm: option.diameterMm?.toString() ?? null,
      usEquivalent: option.usEquivalent,
      ukEquivalent: option.ukEquivalent,
    }));
  }

  /**
   * Values accepted for a scheme when validating a variant.
   *
   * Includes custom options: a product already carrying "16.5" must survive an
   * unrelated edit. What stops new drift is the admin form not *offering*
   * custom values (criterion 10), not the validator refusing them — refusing
   * would make every legacy product unsaveable.
   */
  async valuesFor(scheme: SizeScheme): Promise<Set<string>> {
    const options = await this.prisma.sizeOption.findMany({
      where: { scheme },
      select: { value: true },
    });
    return new Set(options.map((option) => option.value));
  }
}
