import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminInventoryPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adjustStock, listInventory } from '@/lib/api/admin-inventory';
import { ApiError } from '@/lib/api/client';

let searchParams = new URLSearchParams();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push }),
  usePathname: () => '/admin/inventory',
}));

vi.mock('@/lib/api/admin-inventory', () => ({
  listInventory: vi.fn(),
  adjustStock: vi.fn(),
}));

const listInventoryMock = vi.mocked(listInventory);
const adjustStockMock = vi.mocked(adjustStock);

function item(overrides: Record<string, unknown> = {}) {
  return {
    variantId: 'v1',
    productName: 'Gold Ring',
    productSlug: 'gold-ring',
    sku: 'SKU-1',
    quantityOnHand: 10,
    quantityReserved: 2,
    lowStockThreshold: 5,
    ...overrides,
  };
}

function pageOf(items: ReturnType<typeof item>[], total = items.length) {
  return { items, page: 1, pageSize: 24, total };
}

describe('AdminInventoryPage', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    push.mockReset();
    listInventoryMock.mockReset();
    adjustStockMock.mockReset();
    listInventoryMock.mockResolvedValue(pageOf([item()]) as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows an item well above its low-stock threshold — the actual bug this page fixes', async () => {
    // Previously this page only ever called listLowStock, so a variant
    // that had already been restocked past its threshold was invisible
    // here no matter what — there was no way to add more to it.
    render(<AdminInventoryPage />);
    expect(await screen.findByText('Gold Ring')).toBeInTheDocument();
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
    expect(listInventoryMock).toHaveBeenCalledWith('token-1', {
      page: 1,
      pageSize: 24,
      q: undefined,
      lowStockOnly: undefined,
    });
  });

  it('submitting a search commits it to the URL', async () => {
    const user = userEvent.setup();
    render(<AdminInventoryPage />);
    await screen.findByText('Gold Ring');

    await user.type(screen.getByLabelText('Search inventory by product name or SKU'), 'ring');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith('/admin/inventory?q=ring');
  });

  it('reads the q and lowStockOnly filters from the URL and sends them to the API', async () => {
    searchParams = new URLSearchParams('q=ring&lowStockOnly=true');
    render(<AdminInventoryPage />);
    await screen.findByText('Gold Ring');
    expect(listInventoryMock).toHaveBeenCalledWith('token-1', {
      page: 1,
      pageSize: 24,
      q: 'ring',
      lowStockOnly: true,
    });
  });

  it('toggling "Low stock only" commits it to the URL and drops the current page', async () => {
    searchParams = new URLSearchParams('page=3');
    const user = userEvent.setup();
    render(<AdminInventoryPage />);
    await screen.findByText('Gold Ring');

    await user.click(screen.getByRole('checkbox', { name: /Low stock only/ }));
    expect(push).toHaveBeenCalledWith('/admin/inventory?lowStockOnly=true');
  });

  it('adjusting stock on a healthy item calls the API with its variant id and reloads', async () => {
    adjustStockMock.mockResolvedValue(item({ quantityOnHand: 15 }) as never);
    const user = userEvent.setup();
    render(<AdminInventoryPage />);
    await screen.findByText('Gold Ring');

    await user.type(screen.getByLabelText(/Adjust stock for Gold Ring/), '5');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(adjustStockMock).toHaveBeenCalledWith('token-1', 'v1', 5);
  });

  it('surfaces a failed adjustment instead of failing silently', async () => {
    adjustStockMock.mockRejectedValue(new ApiError('Cannot reduce stock below currently reserved quantity', 409));
    const user = userEvent.setup();
    render(<AdminInventoryPage />);
    await screen.findByText('Gold Ring');

    await user.type(screen.getByLabelText(/Adjust stock for Gold Ring/), '-20');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('Cannot reduce stock below currently reserved quantity')).toBeInTheDocument();
  });

  it('shows an empty state distinguishing "no results for this search" from "nothing at all"', async () => {
    listInventoryMock.mockResolvedValue(pageOf([]) as never);
    searchParams = new URLSearchParams('q=nonexistent');
    render(<AdminInventoryPage />);
    expect(await screen.findByText('No matching inventory.')).toBeInTheDocument();
  });
});
