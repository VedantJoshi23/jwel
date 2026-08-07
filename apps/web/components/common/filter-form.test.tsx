import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterForm } from './filter-form';

describe('FilterForm', () => {
  it('renders as a plain GET form pointed at the given basePath (works without JS)', () => {
    render(<FilterForm basePath="/collections/rings" />);
    const form = screen.getByRole('form', { name: 'Filter products' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/collections/rings');
  });

  it('defaults to "Any metal" when none is specified', () => {
    render(<FilterForm basePath="/collections/rings" />);
    expect(screen.getByLabelText('Any metal')).toBeChecked();
  });

  it('pre-selects the given default metal', () => {
    render(<FilterForm basePath="/collections/rings" defaultMetal="GOLD" />);
    expect(screen.getByLabelText('Gold', { exact: true })).toBeChecked();
    expect(screen.getByLabelText('Any metal')).not.toBeChecked();
  });

  it('pre-fills the given default price range', () => {
    render(<FilterForm basePath="/collections/rings" defaultPriceMin="1000" defaultPriceMax="5000" />);
    expect(screen.getByLabelText(/Minimum price/)).toHaveValue(1000);
    expect(screen.getByLabelText(/Maximum price/)).toHaveValue(5000);
  });

  it('defaults sort to "newest"', () => {
    render(<FilterForm basePath="/collections/rings" />);
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  });

  it('pre-selects the given default sort', () => {
    render(<FilterForm basePath="/collections/rings" defaultSort="price_asc" />);
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_asc');
  });

  it('renders a submit button', () => {
    render(<FilterForm basePath="/collections/rings" />);
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveAttribute('type', 'submit');
  });
});

describe('FilterForm — size (FEAT-SIZE-TAXONOMY)', () => {
  const ringSizes = [
    {
      scheme: 'RING_INDIA' as const,
      value: '16',
      label: '16',
      circumferenceMm: '56.3',
      diameterMm: '17.93',
      usEquivalent: '8',
      ukEquivalent: 'P½',
      isCustom: false,
    },
    {
      scheme: 'RING_INDIA' as const,
      value: '18',
      label: '18',
      circumferenceMm: '58.3',
      diameterMm: '18.54',
      usEquivalent: '9',
      ukEquivalent: 'R½',
      isCustom: false,
    },
  ];

  it('omits the size section entirely when the category has no scheme', () => {
    // An empty size selector on a pair of earrings is worse than none — it
    // implies a choice that does not exist.
    render(<FilterForm basePath="/collections/earrings" />);
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });

  it('renders one radio per seeded size, plus "Any size"', () => {
    render(<FilterForm basePath="/collections/rings" sizeOptions={ringSizes} />);
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByLabelText('16')).toBeInTheDocument();
    expect(screen.getByLabelText('18')).toBeInTheDocument();
    expect(screen.getByLabelText('Any size')).toBeInTheDocument();
  });

  it('submits under the name the API filter expects', () => {
    // `size` — must match QueryProductsDto, or the filter silently does nothing.
    render(<FilterForm basePath="/collections/rings" sizeOptions={ringSizes} />);
    expect(screen.getByLabelText('16')).toHaveAttribute('name', 'size');
  });

  it('preselects the active size', () => {
    render(<FilterForm basePath="/collections/rings" sizeOptions={ringSizes} defaultSize="18" />);
    expect(screen.getByLabelText('18')).toBeChecked();
    expect(screen.getByLabelText('Any size')).not.toBeChecked();
  });

  it('defaults to "Any size" when no size is active', () => {
    render(<FilterForm basePath="/collections/rings" sizeOptions={ringSizes} />);
    expect(screen.getByLabelText('Any size')).toBeChecked();
  });

  it('labels the group for assistive technology', () => {
    // STD-ACCESSIBILITY r7 — a radio group needs a programmatic label, not
    // just a visually adjacent heading.
    render(<FilterForm basePath="/collections/rings" sizeOptions={ringSizes} />);
    expect(screen.getByRole('group', { name: 'Size' })).toBeInTheDocument();
  });
});
