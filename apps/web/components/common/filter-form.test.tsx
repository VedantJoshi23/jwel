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

  it('defaults to "Any" metal when none is specified', () => {
    render(<FilterForm basePath="/collections/rings" />);
    expect(screen.getByLabelText('Any')).toBeChecked();
  });

  it('pre-selects the given default metal', () => {
    render(<FilterForm basePath="/collections/rings" defaultMetal="GOLD" />);
    expect(screen.getByLabelText('Gold')).toBeChecked();
    expect(screen.getByLabelText('Any')).not.toBeChecked();
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
