import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCollectionsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import {
  adminDeleteCollection,
  adminListCollections,
  adminUpdateCollection,
} from '@/lib/api/admin-collections';
import { adminListProducts } from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type { AdminCollection } from '@/lib/api/types';

vi.mock('@/lib/api/admin-collections', () => ({
  adminListCollections: vi.fn(),
  adminCreateCollection: vi.fn(),
  adminUpdateCollection: vi.fn(),
  adminDeleteCollection: vi.fn(),
}));

vi.mock('@/lib/api/admin-products', () => ({
  adminListProducts: vi.fn(),
}));

vi.mock('@/lib/api/admin-uploads', () => ({ adminUploadImage: vi.fn() }));

const listCollections = vi.mocked(adminListCollections);
const updateCollection = vi.mocked(adminUpdateCollection);
const deleteCollection = vi.mocked(adminDeleteCollection);
const listProducts = vi.mocked(adminListProducts);

function makeCollection(overrides: Partial<AdminCollection> = {}): AdminCollection {
  return {
    id: 'c1',
    name: 'Diwali Edit',
    slug: 'diwali-edit',
    type: 'SEASONAL',
    description: 'Festive drop',
    heroImageRef: null,
    heroImageUrl: null,
    isFeatured: false,
    startsAt: null,
    endsAt: null,
    _count: { products: 3 },
    ...overrides,
  };
}

describe('AdminCollectionsPage — edit', () => {
  beforeEach(() => {
    listCollections.mockReset();
    updateCollection.mockReset();
    deleteCollection.mockReset();
    listCollections.mockResolvedValue([makeCollection()]);
    listProducts.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 } as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('offers an Edit affordance alongside Delete for every collection', async () => {
    render(<AdminCollectionsPage />);
    expect(await screen.findByText('Diwali Edit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('pre-fills the edit form from the collection’s current values', async () => {
    render(<AdminCollectionsPage />);
    await screen.findByText('Diwali Edit');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit' }));

    // Scoped to the table: the Create form above has its own same-named
    // "Name"/"Type"/etc labels, so an unscoped query would be ambiguous.
    const table = within(screen.getByRole('table'));
    expect(table.getByLabelText('Name')).toHaveValue('Diwali Edit');
    expect(table.getByLabelText('Slug')).toHaveValue('diwali-edit');
    expect(table.getByLabelText('Description (optional)')).toHaveValue('Festive drop');
  });

  it('saves edited fields via adminUpdateCollection without touching productIds', async () => {
    updateCollection.mockResolvedValue(makeCollection({ name: 'Diwali Mega Edit' }) as never);
    const user = userEvent.setup();
    render(<AdminCollectionsPage />);
    await screen.findByText('Diwali Edit');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const table = within(screen.getByRole('table'));
    const name = table.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Diwali Mega Edit');
    await user.click(table.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateCollection).toHaveBeenCalledWith(
        'token-1',
        'c1',
        expect.objectContaining({ name: 'Diwali Mega Edit' }),
      ),
    );
    // Membership must stay untouched: this list only ever has `_count`, never
    // the member ids, so there is no safe value to send here.
    const [, , body] = updateCollection.mock.calls[0];
    expect(body).not.toHaveProperty('productIds');
    expect(listCollections).toHaveBeenCalledTimes(2);
  });

  it('Cancel discards edits without calling the API', async () => {
    const user = userEvent.setup();
    render(<AdminCollectionsPage />);
    await screen.findByText('Diwali Edit');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const table = within(screen.getByRole('table'));
    await user.type(table.getByLabelText('Name'), ' extra');
    await user.click(table.getByRole('button', { name: 'Cancel' }));

    expect(updateCollection).not.toHaveBeenCalled();
    expect(await screen.findByText('Diwali Edit')).toBeInTheDocument();
  });

  it('surfaces the API error message when saving fails', async () => {
    updateCollection.mockRejectedValue(
      new ApiError('A category with slug "diwali-edit" already exists.', 400),
    );
    const user = userEvent.setup();
    render(<AdminCollectionsPage />);
    await screen.findByText('Diwali Edit');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});
