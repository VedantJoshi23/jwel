import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminProductsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListProducts, adminUpdateProductStatus } from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/products',
}));

vi.mock('@/lib/api/admin-products', () => ({
  adminListProducts: vi.fn(),
  adminUpdateProductStatus: vi.fn(),
  bulkImportProducts: vi.fn(),
  // Pulled in by CatalogueExportControl (FEAT-CATALOGUE-EXPORT), rendered
  // on this page — not this file's own concern, just needs to resolve.
  adminListCategories: vi.fn().mockResolvedValue([]),
  adminDownloadCataloguePdf: vi.fn(),
}));

vi.mock('@/lib/api/admin-collections', () => ({
  adminListCollections: vi.fn().mockResolvedValue([]),
}));

const listProducts = vi.mocked(adminListProducts);

function product(id: string) {
  return {
    id,
    name: `Untitled Draft ${id}`,
    slug: `draft-${id}`,
    status: 'DRAFT' as const,
    category: { id: 'c1', name: 'Rings', slug: 'rings' },
    variants: [{ id: `v${id}`, basePriceMinorUnits: 0 }],
    media: [],
  };
}

// 1046 drafts across 50 per page — the real shape after the uploads import,
// and the case the page previously could not reach past page 1.
function pageOf(page: number, total = 1046) {
  return { items: [product(`p${page}`)], page, pageSize: 50, total };
}

describe('AdminProductsPage', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    listProducts.mockReset();
    listProducts.mockResolvedValue(pageOf(1) as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  // Each case awaits the rendered row before asserting on the call: the fetch
  // resolving and the resulting setState are separate ticks, and asserting
  // between them is what triggers React's act() warning.
  it('requests the first page by default', async () => {
    render(<AdminProductsPage />);
    expect(await screen.findByText('Untitled Draft p1')).toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledWith('token-1', { page: 1, pageSize: 50 });
  });

  it('requests the page named in the URL', async () => {
    searchParams = new URLSearchParams('page=7');
    listProducts.mockResolvedValue(pageOf(7) as never);
    render(<AdminProductsPage />);
    expect(await screen.findByText('Untitled Draft p7')).toBeInTheDocument();
    // The regression this guards: the page used to ignore ?page= entirely and
    // always fetch the first 50, leaving the other 996 unreachable.
    expect(listProducts).toHaveBeenCalledWith('token-1', { page: 7, pageSize: 50 });
  });

  it('falls back to page 1 for a non-numeric ?page=', async () => {
    searchParams = new URLSearchParams('page=banana');
    render(<AdminProductsPage />);
    expect(await screen.findByText('Untitled Draft p1')).toBeInTheDocument();
    expect(listProducts).toHaveBeenCalledWith('token-1', { page: 1, pageSize: 50 });
  });

  it('falls back to page 1 for a zero or negative ?page=', async () => {
    searchParams = new URLSearchParams('page=-3');
    render(<AdminProductsPage />);
    expect(await screen.findByText('Untitled Draft p1')).toBeInTheDocument();
    // A negative page would ask the API for a negative offset.
    expect(listProducts).toHaveBeenCalledWith('token-1', { page: 1, pageSize: 50 });
  });

  it('renders pagination links once the total exceeds one page', async () => {
    render(<AdminProductsPage />);
    const nav = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(nav).toBeInTheDocument();
    // 1046 / 50 = 21 pages, so the last-page link must be reachable directly.
    expect(screen.getByRole('link', { name: '21' })).toHaveAttribute(
      'href',
      '/admin/products?page=21',
    );
  });

  it('shows the total count and the range being displayed', async () => {
    searchParams = new URLSearchParams('page=2');
    listProducts.mockResolvedValue(pageOf(2) as never);
    render(<AdminProductsPage />);
    expect(await screen.findByText(/1,046 products/)).toBeInTheDocument();
    expect(screen.getByText(/showing\s*51–100/)).toBeInTheDocument();
  });

  it('renders no pagination when everything fits on one page', async () => {
    listProducts.mockResolvedValue({ items: [product('a')], page: 1, pageSize: 50, total: 1 } as never);
    render(<AdminProductsPage />);
    // Wait on the rendered row rather than the mock call: the fetch resolving
    // and the resulting setState are separate ticks, and asserting between
    // them is what produces React's act() warning.
    expect(await screen.findByText('Untitled Draft a')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });
});

describe('AdminProductsPage — publish gate (FEAT-PUBLISH-COMPLETENESS)', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    listProducts.mockReset();
    listProducts.mockResolvedValue(pageOf(1) as never);
    vi.mocked(adminUpdateProductStatus).mockReset();
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'a@b.c',
      name: 'Admin',
      role: 'ADMIN',
    });
  });

  it('shows warnings when a publish succeeds with them', async () => {
    // A warning nobody sees is not a warning — the response is read, not
    // discarded.
    vi.mocked(adminUpdateProductStatus).mockResolvedValue({
      ...product('p1'),
      status: 'PUBLISHED',
      publishWarnings: ['This product has no images. It will publish, but customers will see an empty gallery.'],
    } as never);

    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await screen.findByText('Untitled Draft p1');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Published, with warnings')).toBeInTheDocument();
    expect(screen.getByText(/no images/)).toBeInTheDocument();
  });

  it('shows nothing extra when a publish succeeds cleanly', async () => {
    vi.mocked(adminUpdateProductStatus).mockResolvedValue({
      ...product('p1'),
      status: 'PUBLISHED',
      publishWarnings: [],
    } as never);

    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await screen.findByText('Untitled Draft p1');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(adminUpdateProductStatus).toHaveBeenCalled());
    expect(screen.queryByText('Published, with warnings')).not.toBeInTheDocument();
  });

  it('surfaces every blocker from a refused publish', async () => {
    // The API returns one message listing all failures, so the client fixes
    // them in one pass rather than one round trip each.
    vi.mocked(adminUpdateProductStatus).mockRejectedValue(
      new ApiError(
        'Cannot publish "Untitled Draft 1041": Name is still the generated placeholder. Variant "SKU-1" has no price.',
        400,
      ),
    );

    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await screen.findByText('Untitled Draft p1');
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText(/generated placeholder/)).toBeInTheDocument();
    expect(screen.getByText(/has no price/)).toBeInTheDocument();
  });

  it('clears a previous warning when a later publish is clean', async () => {
    vi.mocked(adminUpdateProductStatus)
      .mockResolvedValueOnce({ ...product('p1'), publishWarnings: ['no images'] } as never)
      .mockResolvedValueOnce({ ...product('p1'), publishWarnings: [] } as never);

    const user = userEvent.setup();
    render(<AdminProductsPage />);
    await screen.findByText('Untitled Draft p1');

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published, with warnings')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(screen.queryByText('Published, with warnings')).not.toBeInTheDocument(),
    );
  });
});
