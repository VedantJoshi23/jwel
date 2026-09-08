import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCmsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminDeleteBanner, adminListBanners, adminUpdateBanner } from '@/lib/api/admin-cms';
import { ApiError } from '@/lib/api/client';
import type { Banner } from '@/lib/api/types';

vi.mock('@/lib/api/admin-cms', () => ({
  adminListBanners: vi.fn(),
  adminCreateBanner: vi.fn(),
  adminUpdateBanner: vi.fn(),
  adminDeleteBanner: vi.fn(),
}));

// Exercised only through the upload flow, which these tests don't trigger —
// stubbed so the module resolves.
vi.mock('@/lib/api/admin-uploads', () => ({ adminUploadImage: vi.fn() }));

const listBanners = vi.mocked(adminListBanners);
const updateBanner = vi.mocked(adminUpdateBanner);
const deleteBanner = vi.mocked(adminDeleteBanner);

function makeBanner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 'b1',
    title: 'Diwali Sale',
    imageRef: 'local:banners/diwali.jpg',
    linkUrl: '/collections/diwali',
    sortOrder: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

describe('AdminCmsPage — banner edit', () => {
  beforeEach(() => {
    listBanners.mockReset();
    updateBanner.mockReset();
    deleteBanner.mockReset();
    listBanners.mockResolvedValue([makeBanner()]);
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('offers an Edit affordance for every banner', async () => {
    render(<AdminCmsPage />);
    expect(await screen.findByText('Diwali Sale')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('pre-fills the edit form from the banner’s current values', async () => {
    render(<AdminCmsPage />);
    await screen.findByText('Diwali Sale');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Title')).toHaveValue('Diwali Sale');
    expect(screen.getByLabelText('Link URL')).toHaveValue('/collections/diwali');
    expect(screen.getByLabelText('Sort order')).toHaveValue(0);
    expect(screen.getByLabelText('Active')).toBeChecked();
  });

  it('saves edited fields via adminUpdateBanner and reloads the list', async () => {
    updateBanner.mockResolvedValue(makeBanner({ title: 'Diwali Mega Sale' }));
    const user = userEvent.setup();
    render(<AdminCmsPage />);
    await screen.findByText('Diwali Sale');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Diwali Mega Sale');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateBanner).toHaveBeenCalledWith(
        'token-1',
        'b1',
        expect.objectContaining({ title: 'Diwali Mega Sale', imageRef: 'local:banners/diwali.jpg' }),
      ),
    );
    expect(listBanners).toHaveBeenCalledTimes(2);
  });

  it('toggling Active off and saving sends isActive: false', async () => {
    updateBanner.mockResolvedValue(makeBanner({ isActive: false }));
    const user = userEvent.setup();
    render(<AdminCmsPage />);
    await screen.findByText('Diwali Sale');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByLabelText('Active'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateBanner).toHaveBeenCalledWith('token-1', 'b1', expect.objectContaining({ isActive: false })),
    );
  });

  it('Cancel discards edits without calling the API', async () => {
    const user = userEvent.setup();
    render(<AdminCmsPage />);
    await screen.findByText('Diwali Sale');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), ' extra');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateBanner).not.toHaveBeenCalled();
    expect(await screen.findByText('Diwali Sale')).toBeInTheDocument();
  });

  it('surfaces the API error message when saving fails', async () => {
    updateBanner.mockRejectedValue(new ApiError('linkUrl must be an absolute http(s) URL or a root-relative path', 400));
    const user = userEvent.setup();
    render(<AdminCmsPage />);
    await screen.findByText('Diwali Sale');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/root-relative path/)).toBeInTheDocument();
  });
});
