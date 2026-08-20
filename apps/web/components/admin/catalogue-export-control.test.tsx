import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogueExportControl } from './catalogue-export-control';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api/client';

const downloadMock = vi.fn();
vi.mock('@/lib/api/admin-products', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-products')>('@/lib/api/admin-products');
  return {
    ...actual,
    adminDownloadCataloguePdf: (...args: unknown[]) => downloadMock(...args),
    adminListCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Rings', slug: 'rings' }]),
  };
});
vi.mock('@/lib/api/admin-collections', () => ({
  adminListCollections: vi.fn().mockResolvedValue([{ id: 'col-1', name: 'Bestsellers', slug: 'bestsellers' }]),
}));

describe('CatalogueExportControl', () => {
  beforeEach(() => {
    downloadMock.mockReset();
    downloadMock.mockResolvedValue(undefined);
    useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.com', name: null, role: 'ADMIN' });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('defaults to the whole catalogue and downloads with an empty scope', async () => {
    const user = userEvent.setup();
    render(<CatalogueExportControl />);

    await user.click(screen.getByRole('button', { name: 'Download catalogue (PDF)' }));

    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith('token-1', {}));
  });

  it('disables the download button until a category is chosen, then scopes to it', async () => {
    const user = userEvent.setup();
    render(<CatalogueExportControl />);

    await user.selectOptions(screen.getByLabelText('Catalogue PDF scope'), 'category');
    expect(screen.getByRole('button', { name: 'Download catalogue (PDF)' })).toBeDisabled();

    await waitFor(() => expect(screen.getByLabelText('Category')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Category'), 'cat-1');
    expect(screen.getByRole('button', { name: 'Download catalogue (PDF)' })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Download catalogue (PDF)' }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith('token-1', { categoryId: 'cat-1' }));
  });

  it('disables the download button until a collection is chosen, then scopes to it', async () => {
    const user = userEvent.setup();
    render(<CatalogueExportControl />);

    await user.selectOptions(screen.getByLabelText('Catalogue PDF scope'), 'collection');
    expect(screen.getByRole('button', { name: 'Download catalogue (PDF)' })).toBeDisabled();

    await waitFor(() => expect(screen.getByLabelText('Collection')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Collection'), 'col-1');

    await user.click(screen.getByRole('button', { name: 'Download catalogue (PDF)' }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith('token-1', { collectionId: 'col-1' }));
  });

  it('shows an ApiError message when generation fails', async () => {
    downloadMock.mockRejectedValue(new ApiError('No published products', 404));
    const user = userEvent.setup();
    render(<CatalogueExportControl />);

    await user.click(screen.getByRole('button', { name: 'Download catalogue (PDF)' }));

    expect(await screen.findByText('No published products')).toBeInTheDocument();
  });
});
