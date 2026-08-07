import { BadRequestException } from '@nestjs/common';

/**
 * FEAT-PUBLISH-COMPLETENESS — the gate on `DRAFT → PUBLISHED`.
 *
 * Publishing used to validate nothing: `status` was a plain field on
 * `UpdateProductDto` passed straight to `product.update` (KC-185). That is how
 * a ₹0 placeholder named "Untitled Draft 1041" became shoppable and took
 * orders. The catalogue holds 1,045 more of them, and the client is the party
 * who will be publishing them.
 *
 * **The rule that decides block from warning** (owner decision, 2026-08-07):
 *
 * - **Hard block** when absence fails *silently* — the product looks fine but
 *   cannot be found. Price, name, description and size all feed search,
 *   filtering or sorting.
 * - **Warning** when absence fails *visibly* — a product with no image is
 *   obviously wrong to anyone who looks at the storefront, and blocking would
 *   stop a client publishing a correct product because one photo is still
 *   being edited.
 *
 * That is the principle, not the list. A future field is classified by
 * applying it, not by precedent.
 *
 * These are pure functions over an already-loaded product so the branching is
 * directly testable without a Prisma mock (`STD-TESTING` r6). The rule spans
 * Product → ProductVariant → ProductMedia, so it cannot be a CHECK constraint;
 * per `STD-DATABASE` r6 that limitation is documented at the schema with this
 * module named as the enforcer.
 */

/**
 * Patterns emitted by `scripts/seed-draft-products-from-uploads.ts`.
 *
 * These must track that script. "Not a placeholder" cannot simply mean "not
 * empty" — every one of the 1,045 drafts has both a name and a description,
 * which is precisely why a presence check would let them all through.
 *
 * If the generator's wording changes and these do not, the gate **fails open**
 * and publishes exactly what it exists to stop. `publish-validation.spec.ts`
 * pins the two together with the literal strings the generator produces.
 */
const PLACEHOLDER_NAME = /^untitled draft\b/i;
const PLACEHOLDER_DESCRIPTION = /^pending\s*[—–-]\s*placeholder draft/i;

export interface PublishCandidateVariant {
  sku: string;
  basePriceMinorUnits: number;
  size: string | null;
}

export interface PublishCandidate {
  name: string;
  description: string;
  variants: PublishCandidateVariant[];
  mediaCount: number;
  /** Null when the product's category has no sizing scheme. */
  sizeScheme: string | null;
}

export interface PublishCheckResult {
  /** Reasons publication must be refused. Empty means publishable. */
  blockers: string[];
  /** Reasons to proceed but tell the operator. */
  warnings: string[];
}

function isBlank(value: string | null | undefined): boolean {
  // Whitespace-only counts as absent: "   " passes a naive presence check and
  // contributes nothing to `search_vector` (§7.7).
  return !value || value.trim() === '';
}

/**
 * Evaluates a product against the gate. Collects **every** failure rather than
 * returning on the first — a client fixing five problems one round trip at a
 * time will lose patience with the tool and find a way around it (§3.7).
 */
export function checkPublishable(product: PublishCandidate): PublishCheckResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // --- Name: feeds search_vector and is the primary match target.
  if (isBlank(product.name)) {
    blockers.push('Name is required.');
  } else if (PLACEHOLDER_NAME.test(product.name.trim())) {
    blockers.push(`Name is still the generated placeholder ("${product.name}").`);
  }

  // --- Description: search_vector is generated from name || description, so a
  // product without one is materially less findable and nothing on the
  // storefront reveals it. This is the clearest silent failure of the set.
  if (isBlank(product.description)) {
    blockers.push('Description is required — it feeds product search.');
  } else if (PLACEHOLDER_DESCRIPTION.test(product.description.trim())) {
    blockers.push('Description is still the generated placeholder text.');
  }

  // --- Variants: no variant means no price, no size, nothing to add to a cart.
  if (product.variants.length === 0) {
    blockers.push('At least one variant is required.');
  }

  for (const variant of product.variants) {
    // --- Price: drives sort and the price-range filter. A ₹0 product sorts to
    // the top of "price: low to high" and matches every price filter.
    if (variant.basePriceMinorUnits <= 0) {
      blockers.push(`Variant "${variant.sku}" has no price.`);
    }

    // --- Size: drives the category filter. Only checked where the category
    // has a scheme — an earring has no size and must not be asked for one
    // (FEAT-SIZE-TAXONOMY).
    if (product.sizeScheme !== null && isBlank(variant.size)) {
      blockers.push(`Variant "${variant.sku}" has no size.`);
    }
  }

  // --- Media: a warning, not a block. Fails visibly.
  if (product.mediaCount === 0) {
    warnings.push('This product has no images. It will publish, but customers will see an empty gallery.');
  }

  return { blockers, warnings };
}

/**
 * Throws if the product cannot be published, listing every blocker.
 *
 * @returns the warnings, for the caller to hand back to the operator. A
 *   warning nobody sees is not a warning (§3.3).
 */
export function assertPublishable(product: PublishCandidate): string[] {
  const { blockers, warnings } = checkPublishable(product);

  if (blockers.length > 0) {
    throw new BadRequestException(
      `Cannot publish "${product.name || 'this product'}": ${blockers.join(' ')}`,
    );
  }

  return warnings;
}
