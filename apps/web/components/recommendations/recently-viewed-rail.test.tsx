import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecentlyViewedRail } from './recently-viewed-rail';
import { RecommendedRail } from './personalized-rail';
import { useAuthStore } from '@/lib/auth-store';
import { getPersonalized, getRecentlyViewed, getTrending } from '@/lib/api/recommendations';

vi.mock('@/lib/api/recommendations', () => ({
  getRecentlyViewed: vi.fn(),
  getPersonalized: vi.fn(),
  getTrending: vi.fn(),
}));

const recent = vi.mocked(getRecentlyViewed);
const personalized = vi.mocked(getPersonalized);
const trending = vi.mocked(getTrending);

const product = (over = {}) => ({
  productId: 'p1',
  slug: 'gold-ring',
  name: 'Gold Ring',
  categorySlug: 'rings',
  priceMinMinorUnits: 250000,
  avgRating: 4.5,
  ratingCount: 10,
  thumbnailRef: null,
  ...over,
});

function renderRail(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('RecentlyViewedRail', () => {
  beforeEach(() => {
    recent.mockReset();
    recent.mockResolvedValue([product()] as never);
  });
  afterEach(() => useAuthStore.getState().logout());

  it('keeps the product you are looking at out of its own rail', async () => {
    // It would otherwise be the first entry, the moment the view is recorded.
    recent.mockResolvedValue([product(), product({ productId: 'p2', name: 'Other Ring' })] as never);

    renderRail(<RecentlyViewedRail excludeProductId="p1" />);

    expect(await screen.findByText('Other Ring')).toBeInTheDocument();
    expect(screen.queryByText('Gold Ring')).not.toBeInTheDocument();
  });

  it('renders nothing while loading, rather than an empty heading', () => {
    const { container } = renderRail(<RecentlyViewedRail />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the request fails', async () => {
    recent.mockRejectedValue(new Error('down'));
    const { container } = renderRail(<RecentlyViewedRail />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RecommendedRail', () => {
  beforeEach(() => {
    personalized.mockReset();
    trending.mockReset();
    personalized.mockResolvedValue([product()] as never);
    trending.mockResolvedValue([product({ name: 'Trending Ring' })] as never);
  });
  afterEach(() => useAuthStore.getState().logout());

  it('says "Trending now" to a visitor, and asks for trending', async () => {
    // Calling a trending list "recommended for you" would claim a
    // personalisation that did not happen.
    renderRail(<RecommendedRail />);
    expect(await screen.findByRole('heading', { name: 'Trending now' })).toBeInTheDocument();
    expect(personalized).not.toHaveBeenCalled();
  });

  it('says "Recommended for you" to a signed-in customer', async () => {
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'a@b.c',
      name: null,
      role: 'CUSTOMER',
    });

    renderRail(<RecommendedRail />);

    expect(await screen.findByRole('heading', { name: 'Recommended for you' })).toBeInTheDocument();
    expect(personalized).toHaveBeenCalledWith('token-1');
  });
});
