import { BadRequestException } from '@nestjs/common';
import { SizeScheme } from '@prisma/client';

/**
 * FEAT-SIZE-TAXONOMY — validating a variant's size against its category's
 * sizing scheme.
 *
 * This rule cannot be a database constraint. The valid set for a variant
 * depends on its product's category's scheme — three tables away — and a CHECK
 * constraint cannot reach across rows. So it lives here, and per
 * `STD-DATABASE` r6 the limitation is documented at the schema (see the
 * `SizeOption` model comment) with this module named as the enforcer.
 *
 * Kept as pure functions rather than service methods so the branching logic is
 * directly testable without a Prisma mock — `STD-TESTING` r6 wants every edge
 * case in FEAT-SIZE-TAXONOMY §7 covered, and most of them are decisions, not
 * queries.
 */

/**
 * Resolves the scheme that applies to a category, walking a materialised
 * ancestor chain nearest-first.
 *
 * A child inherits its parent's scheme, so "Solitaire" under "Rings" is sized
 * without restating it. The caller loads the chain because Prisma cannot
 * express a recursive default.
 *
 * Two distinct "no scheme" cases, which is why `SizeScheme.NONE` exists:
 *
 * - a **NULL** column means "not set — inherit from my parent". A root
 *   category with NULL resolves to unsized, because there is nothing above it
 *   to inherit. That is Earrings.
 * - **`SizeScheme.NONE`** means "no size at all", and stops the walk. That is
 *   an Adjustable ring under Rings, which must not inherit `RING_INDIA`.
 *
 * Collapsing these into NULL alone was the first implementation, and testing
 * against real rows showed Adjustable inheriting its parent's ring scheme.
 * Returns `null` for both cases, since callers only care whether a size is
 * required.
 */
export function resolveSchemeFromChain(chain: Array<{ sizeScheme: SizeScheme | null }>): SizeScheme | null {
  for (const node of chain) {
    if (node.sizeScheme === SizeScheme.NONE) return null;
    if (node.sizeScheme !== null) return node.sizeScheme;
  }
  return null;
}

export interface VariantSizeInput {
  sku: string;
  size?: string | null;
}

/**
 * Enforces FEAT-SIZE-TAXONOMY acceptance criterion 4:
 *
 * - a variant in a **sized** category must carry a size, and it must be one of
 *   the seeded values for that scheme;
 * - a variant in an **unsized** category must not carry one at all.
 *
 * The second half matters as much as the first. Without it, a size silently
 * set on an earring survives into the product payload and the storefront finds
 * itself rendering a size selector for something that has no size.
 *
 * @throws BadRequestException naming the offending SKU and the valid values,
 *   because the caller is usually a bulk CSV import where "invalid size" with
 *   no row context is unactionable (FEAT-SIZE-TAXONOMY §7.7).
 */
export function assertVariantSizes(
  variants: VariantSizeInput[],
  scheme: SizeScheme | null,
  validValues: Set<string>,
): void {
  for (const variant of variants) {
    const size = variant.size ?? null;

    if (scheme === null) {
      if (size !== null && size !== '') {
        throw new BadRequestException(
          `Variant "${variant.sku}" has size "${size}", but its category has no sizing scheme. ` +
            'Remove the size, or assign a scheme to the category.',
        );
      }
      continue;
    }

    if (size === null || size === '') {
      throw new BadRequestException(
        `Variant "${variant.sku}" needs a size — its category uses the ${scheme} scheme.`,
      );
    }

    if (!validValues.has(size)) {
      throw new BadRequestException(
        `Variant "${variant.sku}" has size "${size}", which is not a valid ${scheme} value. ` +
          `Valid values: ${[...validValues].join(', ')}.`,
      );
    }
  }
}
