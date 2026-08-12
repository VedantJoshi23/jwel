import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminCategoriesPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListCategories } from '@/lib/api/admin-products';
import { adminUpdateCategory } from '@/lib/api/admin-categories';
import type { Category } from '@/lib/api/types';

vi.mock('@/lib/api/admin-products', () => ({ adminListCategories: vi.fn() }));
vi.mock('@/lib/api/admin-categories', () => ({
  adminCreateCategory: vi.fn(),
  adminUpdateCategory: vi.fn(),
  adminDeleteCategory: vi.fn(),
}));

const list = vi.mocked(adminListCategories);
const update = vi.mocked(adminUpdateCategory);

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Rings',
    slug: 'rings',
    parentId: null,
    sizeScheme: null,
    ...overrides,
  };
}

describe('AdminCategoriesPage', () => {
  beforeEach(() => {
    list.mockReset();
    update.mockReset();
    list.mockResolvedValue([makeCategory()]);
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows "No size scheme set" for a category with none — this is exactly why its storefront size filter was missing', async () => {
    render(<AdminCategoriesPage />);
    expect(await screen.findByText(/No size scheme set/)).toBeInTheDocument();
  });

  it('shows the human label for a category that already has a scheme', async () => {
    list.mockResolvedValue([makeCategory({ sizeScheme: 'RING_INDIA' })]);
    render(<AdminCategoriesPage />);
    expect(await screen.findByText(/Ring size \(India\)/)).toBeInTheDocument();
  });

  it('editing a category and setting its size scheme sends it on save', async () => {
    update.mockResolvedValue(makeCategory({ sizeScheme: 'RING_INDIA' }));
    render(<AdminCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Size scheme'), { target: { value: 'RING_INDIA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'token-1',
        'c1',
        expect.objectContaining({ sizeScheme: 'RING_INDIA' }),
      ),
    );
  });

  it('leaving the scheme at "inherit from parent" sends null, not an empty string', async () => {
    update.mockResolvedValue(makeCategory());
    render(<AdminCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('token-1', 'c1', expect.objectContaining({ sizeScheme: null })),
    );
  });

  it('the edit form pre-fills the scheme select from the category\'s current value', async () => {
    list.mockResolvedValue([makeCategory({ sizeScheme: 'CHAIN_LENGTH_MM' })]);
    render(<AdminCategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Size scheme')).toHaveValue('CHAIN_LENGTH_MM');
  });
});
