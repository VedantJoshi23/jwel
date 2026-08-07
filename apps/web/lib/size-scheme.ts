import type { Category, SizeScheme } from '@/lib/api/types';

/**
 * FEAT-SIZE-TAXONOMY — client-side mirror of the server's scheme resolution.
 *
 * The admin form needs to know a category's scheme the moment the user picks
 * it, before anything is submitted, so this cannot be a round trip. It must
 * stay behaviourally identical to `size-validation.ts`'s
 * `resolveSchemeFromChain` on the API side — the two are tested against the
 * same cases, and a divergence shows up as an admin form offering sizes the
 * API then rejects.
 *
 * The rule, restated because getting it wrong is silent:
 *
 * - `null` on the column means **inherit from parent**. A root category with
 *   null resolves to unsized, because there is nothing above it.
 * - `'NONE'` means **no size at all** and stops the walk. That is how an
 *   Adjustable ring sub-category overrides Rings' `RING_INDIA`.
 *
 * Returns `null` for both "unsized" cases, since every caller only asks
 * whether a size is required.
 */
export function resolveCategoryScheme(
  categoryId: string | null | undefined,
  categories: Category[],
): SizeScheme | null {
  if (!categoryId) return null;

  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = byId.get(categoryId);

  // Bounded like the server's walk. A cycle here would hang the form, and the
  // client's taxonomy is two levels deep.
  for (let depth = 0; current && depth < 5; depth += 1) {
    const scheme = current.sizeScheme;
    if (scheme === 'NONE') return null;
    if (scheme) return scheme;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return null;
}
