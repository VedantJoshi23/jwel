import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from './product-form';
import type { Category, Product } from '@/lib/api/types';
import * as sizesApi from '@/lib/api/sizes';

// Only leaf categories are selectable (see `selectableCategories`), so the
// sized case is exercised through Solitaire — which is also the more
// interesting one, since it *inherits* Rings' scheme through a null rather
// than declaring its own (FEAT-SIZE-TAXONOMY).
//
// Anklets stays unsized so the pre-existing submission tests keep their
// original meaning: they never touched size, and should not have to now.
const CATEGORIES: Category[] = [
  { id: 'c-rings', name: 'Rings', slug: 'rings', parentId: null, sizeScheme: 'RING_INDIA' },
  { id: 'c-solitaire', name: 'Solitaire', slug: 'solitaire', parentId: 'c-rings', sizeScheme: null },
  { id: 'c-anklets', name: 'Anklets', slug: 'anklets', parentId: null, sizeScheme: null },
];

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Gold Ring',
    slug: 'gold-ring',
    description: 'A ring',
    status: 'PUBLISHED',
    certificationType: 'BIS_HALLMARK',
    avgRating: '0',
    ratingCount: 0,
    category: { id: 'c-solitaire', name: 'Solitaire', slug: 'solitaire', parentId: 'c-rings' },
    variants: [
      {
        id: 'v1',
        sku: 'SKU-1',
        metal: 'GOLD',
        purity: '18K',
        size: '12',
        weightGrams: '2.5',
        basePriceMinorUnits: 250000,
      },
    ],
    media: [],
    ...overrides,
  };
}

function renderForm(props: Partial<React.ComponentProps<typeof ProductForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <ProductForm
      mode="create"
      categories={CATEGORIES}
      submitting={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit };
}

describe('ProductForm', () => {
  describe('category selection', () => {
    // A product must sit on a leaf category — parents are groupings only, so
    // offering them would let an admin file a ring under "Rings" itself.
    it('excludes categories that have children', () => {
      renderForm();

      const options = Array.from(
        screen.getByLabelText('Category').querySelectorAll('option'),
      ).map((o) => o.textContent);

      expect(options).not.toContain('Rings');
      expect(options).toContain('Anklets');
    });

    it('qualifies a subcategory with its parent name', () => {
      renderForm();

      expect(screen.getByRole('option', { name: 'Rings — Solitaire' })).toBeInTheDocument();
    });

    it('falls back to the bare name when the parent is missing from the list', () => {
      render(
        <ProductForm
          mode="create"
          categories={[{ id: 'c-x', name: 'Orphan', slug: 'orphan', parentId: 'gone' }]}
          submitting={false}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByRole('option', { name: 'Orphan' })).toBeInTheDocument();
    });
  });

  describe('slug derivation', () => {
    it('derives the slug from the name while untouched', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Name'), 'Rose Gold Ring');

      expect(screen.getByLabelText('Slug')).toHaveValue('rose-gold-ring');
    });

    it('strips punctuation and collapses separators', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Name'), "Aisha's  22K — Bangle!");

      expect(screen.getByLabelText('Slug')).toHaveValue('aisha-s-22k-bangle');
    });

    // Once the admin edits the slug by hand, typing in Name must not clobber it.
    it('stops deriving once the slug is edited manually', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Slug'), 'custom-slug');
      await user.type(screen.getByLabelText('Name'), 'Something Else');

      expect(screen.getByLabelText('Slug')).toHaveValue('custom-slug');
    });

    it('never re-derives the slug in edit mode', async () => {
      const user = userEvent.setup();
      renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      await user.type(screen.getByLabelText('Name'), ' Updated');

      expect(screen.getByLabelText('Slug')).toHaveValue('gold-ring');
    });
  });

  describe('edit mode', () => {
    it('prefills from the product and its first variant', () => {
      renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      expect(screen.getByLabelText('Name')).toHaveValue('Gold Ring');
      expect(screen.getByLabelText('Description')).toHaveValue('A ring');
      expect(screen.getByLabelText('Category')).toHaveValue('c-solitaire');
      expect(screen.getByLabelText('Certification (optional)')).toHaveValue('BIS_HALLMARK');
    });

    // Stored in minor units (paise); the admin edits rupees.
    it('converts the stored minor-unit price to rupees', () => {
      renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      expect(screen.getByLabelText('Price (₹)')).toHaveValue(2500);
    });

    // UpdateProductDto accepts no variant fields other than price, so exposing
    // them would offer edits the API silently discards.
    it('hides variant fields that cannot be updated', () => {
      renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      expect(screen.queryByLabelText('SKU')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Metal')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Weight (grams)')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Price (₹)')).toBeInTheDocument();
    });

    it('labels the submit button for the mode', () => {
      renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });

    it('tolerates a product with no variants', () => {
      renderForm({ mode: 'edit', initialProduct: fakeProduct({ variants: [] }) });

      expect(screen.getByLabelText('Price (₹)')).toHaveValue(null);
    });
  });

  describe('create mode', () => {
    it('shows the full variant fieldset', () => {
      renderForm();

      expect(screen.getByLabelText('SKU')).toBeInTheDocument();
      expect(screen.getByLabelText('Metal')).toBeInTheDocument();
      expect(screen.getByLabelText('Weight (grams)')).toBeInTheDocument();
    });

    it('defaults metal to SILVER', () => {
      renderForm();

      expect(screen.getByLabelText('Metal')).toHaveValue('SILVER');
    });

    it('labels the submit button for the mode', () => {
      renderForm();

      expect(screen.getByRole('button', { name: 'Create product' })).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('passes the collected values up', async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm();

      await user.type(screen.getByLabelText('Name'), 'Silver Anklet');
      await user.selectOptions(screen.getByLabelText('Category'), 'c-anklets');
      await user.type(screen.getByLabelText('Description'), 'Nice');
      await user.type(screen.getByLabelText('SKU'), 'SKU-9');
      await user.type(screen.getByLabelText('Weight (grams)'), '3');
      await user.type(screen.getByLabelText('Price (₹)'), '1200');
      await user.click(screen.getByRole('button', { name: 'Create product' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Silver Anklet',
          slug: 'silver-anklet',
          categoryId: 'c-anklets',
          description: 'Nice',
          sku: 'SKU-9',
          weightGrams: '3',
          basePriceMinorUnits: '1200',
        }),
      );
    });

    // The optional fields have their own change handlers; without exercising
    // them a typo in one would ship silently.
    it('carries the optional variant and certification fields through', async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm();

      await user.type(screen.getByLabelText('Name'), 'Silver Toe Ring');
      await user.selectOptions(screen.getByLabelText('Category'), 'c-anklets');
      await user.type(screen.getByLabelText('Description'), 'Nice');
      await user.selectOptions(screen.getByLabelText('Certification (optional)'), 'IGI');
      await user.type(screen.getByLabelText('SKU'), 'SKU-7');
      await user.selectOptions(screen.getByLabelText('Metal'), 'PLATINUM');
      await user.type(screen.getByLabelText('Purity (optional)'), '950');
      // Size is no longer a free-text field — it is a constrained selector,
      // covered by its own describe block below (FEAT-SIZE-TAXONOMY).
      await user.type(screen.getByLabelText('Weight (grams)'), '1.5');
      await user.type(screen.getByLabelText('Price (₹)'), '900');
      await user.click(screen.getByRole('button', { name: 'Create product' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          certificationType: 'IGI',
          metal: 'PLATINUM',
          purity: '950',
          weightGrams: '1.5',
        }),
      );
    });

    it('allows clearing the certification back to none', async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm({ mode: 'edit', initialProduct: fakeProduct() });

      await user.selectOptions(screen.getByLabelText('Certification (optional)'), '');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ certificationType: '' }));
    });

    it('renders a submission error', () => {
      renderForm({ error: 'Slug already exists' });

      expect(screen.getByText('Slug already exists')).toBeInTheDocument();
    });

    it('reflects the submitting state on the button', () => {
      renderForm({ submitting: true });

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});

describe('ProductForm — size selector (FEAT-SIZE-TAXONOMY)', () => {
  const RING_OPTIONS = [
    {
      scheme: 'RING_INDIA' as const,
      value: '16',
      label: '16',
      circumferenceMm: '56.3',
      diameterMm: '17.93',
      usEquivalent: '8',
      ukEquivalent: 'P½',
    },
  ];

  afterEach(() => vi.restoreAllMocks());

  it('hides the size field until a category is chosen', () => {
    render(
      <ProductForm
        mode="create"
        categories={CATEGORIES}
        submitting={false}
        error=""
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Size')).not.toBeInTheDocument();
  });

  it('hides the size field for a category with no scheme', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        categories={CATEGORIES}
        submitting={false}
        error=""
        onSubmit={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Category'), 'c-anklets');
    expect(screen.queryByLabelText('Size')).not.toBeInTheDocument();
  });

  it('shows a constrained selector once a sized category is chosen', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue(RING_OPTIONS);
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        categories={CATEGORIES}
        submitting={false}
        error=""
        onSubmit={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Category'), 'c-solitaire');

    const field = await screen.findByLabelText('Size');
    // A select, not a text input — free text is what produced the inconsistent
    // vocabulary this feature replaces.
    expect(field.tagName).toBe('SELECT');
    await waitFor(() => expect(screen.getByRole('option', { name: '16' })).toBeInTheDocument());
  });

  it('resolves an inherited scheme for a sub-category', async () => {
    const spy = vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue(RING_OPTIONS);
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        categories={CATEGORIES}
        submitting={false}
        error=""
        onSubmit={vi.fn()}
      />,
    );

    // Solitaire has a null scheme and sits under Rings, so it inherits.
    await user.selectOptions(screen.getByLabelText('Category'), 'c-solitaire');

    await waitFor(() => expect(spy).toHaveBeenCalledWith('RING_INDIA'));
  });

  it('clears a stale size when switching to an unsized category', async () => {
    vi.spyOn(sizesApi, 'safeGetSizes').mockResolvedValue(RING_OPTIONS);
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        categories={CATEGORIES}
        submitting={false}
        error=""
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Category'), 'c-solitaire');
    await waitFor(() => expect(screen.getByRole('option', { name: '16' })).toBeInTheDocument());
    await user.selectOptions(await screen.findByLabelText('Size'), '16');

    // Without the clear, the stale "16" would be submitted for an earring and
    // the API would reject the whole product over a field the form no longer
    // shows.
    await user.selectOptions(screen.getByLabelText('Category'), 'c-anklets');
    await waitFor(() => expect(screen.queryByLabelText('Size')).not.toBeInTheDocument());

    await user.type(screen.getByLabelText('Name'), 'Studs');
    await user.type(screen.getByLabelText('Description'), 'Nice');
    await user.type(screen.getByLabelText('SKU'), 'SKU-1');
    await user.type(screen.getByLabelText('Weight (grams)'), '1');
    await user.type(screen.getByLabelText('Price (₹)'), '100');
    await user.click(screen.getByRole('button', { name: 'Create product' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ size: '' }));
  });
});
