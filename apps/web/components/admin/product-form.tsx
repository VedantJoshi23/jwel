'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Category, CertificationType, MetalType, Product } from '@/lib/api/types';
import { resolveCategoryScheme } from '@/lib/size-scheme';
import { safeGetSizes } from '@/lib/api/sizes';
import type { SizeOption } from '@/lib/api/types';

const METAL_TYPES: MetalType[] = ['GOLD', 'GOLD_PLATED', 'SILVER', 'PLATINUM', 'STAINLESS_STEEL'];
const CERTIFICATION_TYPES: CertificationType[] = ['BIS_HALLMARK', 'IGI', 'GIA', 'SGL', 'HKD'];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const selectClassName =
  'flex h-11 w-full rounded-s border border-border bg-surface px-3 text-sm text-ink-primary disabled:cursor-not-allowed disabled:opacity-50';

export interface ProductFormValues {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  certificationType: CertificationType | '';
  sku: string;
  metal: MetalType;
  purity: string;
  size: string;
  weightGrams: string;
  basePriceMinorUnits: string;
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  categories: Category[];
  initialProduct?: Product;
  submitting: boolean;
  error?: string;
  onSubmit: (values: ProductFormValues) => void;
}

function categoryLabel(category: Category, categories: Category[]): string {
  if (!category.parentId) return category.name;
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} — ${category.name}` : category.name;
}

export function ProductForm({ mode, categories, initialProduct, submitting, error, onSubmit }: ProductFormProps) {
  const firstVariant = initialProduct?.variants[0];
  const [values, setValues] = useState<ProductFormValues>({
    name: initialProduct?.name ?? '',
    slug: initialProduct?.slug ?? '',
    categoryId: initialProduct?.category.id ?? '',
    description: initialProduct?.description ?? '',
    certificationType: initialProduct?.certificationType ?? '',
    sku: firstVariant?.sku ?? '',
    metal: firstVariant?.metal ?? 'SILVER',
    purity: firstVariant?.purity ?? '',
    size: firstVariant?.size ?? '',
    weightGrams: firstVariant?.weightGrams ?? '',
    basePriceMinorUnits: firstVariant ? String(firstVariant.basePriceMinorUnits / 100) : '',
  });
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  // FEAT-SIZE-TAXONOMY. Resolved client-side rather than fetched, so the size
  // field appears the instant a category is picked — the same walk the API
  // performs, in lib/size-scheme.ts.
  const sizeScheme = resolveCategoryScheme(values.categoryId, categories);
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!sizeScheme) {
      setSizeOptions([]);
      return;
    }
    // curatedOnly: a custom value exists because legacy data had it, not
    // because it is a size anyone should pick going forward. Offering it here
    // would let the free-text vocabulary creep back one product at a time
    // (FEAT-SIZE-TAXONOMY criterion 10).
    safeGetSizes(sizeScheme, { curatedOnly: true }).then((options) => {
      if (!cancelled) setSizeOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [sizeScheme]);

  // Switching from a sized category to an unsized one must clear the size, or
  // a stale value is submitted and the API rejects the whole product with a
  // message about a field the form is no longer showing.
  useEffect(() => {
    if (!sizeScheme && values.size) {
      setValues((prev) => ({ ...prev, size: '' }));
    }
  }, [sizeScheme, values.size]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(value as string);
      return next;
    });
  }

  // Categories with children are groupings only, not selectable — a product
  // must belong to a specific subcategory (or a childless top-level one).
  const parentIds = new Set(categories.map((c) => c.parentId).filter(Boolean));
  const selectableCategories = categories.filter((c) => !parentIds.has(c.id));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="pf-name">
            Name
          </label>
          <Input id="pf-name" required value={values.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="pf-slug">
            Slug
          </label>
          <Input
            id="pf-slug"
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="pf-category">
          Category
        </label>
        <select
          id="pf-category"
          required
          className={cn(selectClassName)}
          value={values.categoryId}
          onChange={(e) => update('categoryId', e.target.value)}
        >
          <option value="" disabled>
            Select a category
          </option>
          {selectableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryLabel(category, categories)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="pf-description">
          Description
        </label>
        <textarea
          id="pf-description"
          required
          rows={4}
          className="w-full rounded-s border border-border bg-surface px-3 py-2 text-sm text-ink-primary"
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="pf-certification">
          Certification (optional)
        </label>
        <select
          id="pf-certification"
          className={cn(selectClassName)}
          value={values.certificationType}
          onChange={(e) => update('certificationType', e.target.value as CertificationType | '')}
        >
          <option value="">None</option>
          {CERTIFICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-s border border-border p-4">
        <legend className="px-1 text-sm font-medium">
          {mode === 'create' ? 'Variant' : 'Price'}
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pf-sku">
                SKU
              </label>
              <Input id="pf-sku" required value={values.sku} onChange={(e) => update('sku', e.target.value)} />
            </div>
          )}
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pf-metal">
                Metal
              </label>
              <select
                id="pf-metal"
                className={cn(selectClassName)}
                value={values.metal}
                onChange={(e) => update('metal', e.target.value as MetalType)}
              >
                {METAL_TYPES.map((metal) => (
                  <option key={metal} value={metal}>
                    {metal}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pf-purity">
                Purity (optional)
              </label>
              <Input id="pf-purity" value={values.purity} onChange={(e) => update('purity', e.target.value)} placeholder="925" />
            </div>
          )}
          {/* Size — a constrained selector, and only for categories that have a
              sizing scheme. Free text here is what produced the inconsistent
              vocabulary FEAT-SIZE-TAXONOMY replaces, and the API now rejects
              both an unknown value and a size on an unsized category. */}
          {mode === 'create' && sizeScheme && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pf-size">
                Size
              </label>
              <select
                id="pf-size"
                required
                className={cn(selectClassName)}
                value={values.size}
                onChange={(e) => update('size', e.target.value)}
              >
                <option value="" disabled>
                  {sizeOptions.length === 0 ? 'Loading sizes…' : 'Select a size'}
                </option>
                {sizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="pf-weight">
                Weight (grams)
              </label>
              <Input
                id="pf-weight"
                type="number"
                step="0.01"
                min="0"
                required
                value={values.weightGrams}
                onChange={(e) => update('weightGrams', e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="pf-price">
              Price (₹)
            </label>
            <Input
              id="pf-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={values.basePriceMinorUnits}
              onChange={(e) => update('basePriceMinorUnits', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-feedback-error">{error}</p>}

      <Button type="submit" loading={submitting}>
        {mode === 'create' ? 'Create product' : 'Save changes'}
      </Button>
    </form>
  );
}
