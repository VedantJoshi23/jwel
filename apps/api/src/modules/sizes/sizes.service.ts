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
  circumferenceMm: string;
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

  async findAll(scheme?: SizeScheme): Promise<SizeOptionResponse[]> {
    const options = await this.prisma.sizeOption.findMany({
      where: scheme ? { scheme } : undefined,
      orderBy: [{ scheme: 'asc' }, { sortOrder: 'asc' }],
    });

    return options.map((option) => ({
      scheme: option.scheme,
      value: option.value,
      label: option.label,
      circumferenceMm: option.circumferenceMm.toString(),
      diameterMm: option.diameterMm?.toString() ?? null,
      usEquivalent: option.usEquivalent,
      ukEquivalent: option.ukEquivalent,
    }));
  }

  /** Canonical values for a scheme, for validating a variant's size. */
  async valuesFor(scheme: SizeScheme): Promise<Set<string>> {
    const options = await this.prisma.sizeOption.findMany({
      where: { scheme },
      select: { value: true },
    });
    return new Set(options.map((option) => option.value));
  }
}
