import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchSuggestions } from './search-suggestions';
import { autocomplete } from '@/lib/api/search';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/search', () => ({ autocomplete: vi.fn(), searchProducts: vi.fn() }));

const suggest = vi.mocked(autocomplete);

function renderSuggestions(query: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchSuggestions query={query} inputId="site-search" onNavigate={vi.fn()} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** FR-3's autosuggest, which had no surface at all (KC-116). */
describe('SearchSuggestions', () => {
  beforeEach(() => {
    push.mockClear();
    suggest.mockReset();
    suggest.mockResolvedValue([
      { productId: 'p1', slug: 'diamond-halo-ring', name: 'Diamond Halo Ring' },
    ]);
  });

  it('asks for nothing on a single character', async () => {
    // One letter matches most of a catalogue; a suggestion needs to be about
    // something.
    renderSuggestions('d');
    await new Promise((r) => setTimeout(r, 300));
    expect(suggest).not.toHaveBeenCalled();
  });

  it('suggests once there is something to go on', async () => {
    renderSuggestions('dia');
    await waitFor(() => expect(suggest).toHaveBeenCalledWith('dia'));
    expect(await screen.findByRole('option', { name: 'Diamond Halo Ring' })).toBeInTheDocument();
  });

  it('is a listbox, so it is announced as a set of options', async () => {
    // A div of links tells a screen reader nothing about how many there are
    // or that they belong to the input.
    renderSuggestions('dia');
    expect(await screen.findByRole('listbox', { name: 'Search suggestions' })).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to suggest', async () => {
    suggest.mockResolvedValue([]);
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SearchSuggestions query="zzzz" inputId="site-search" onNavigate={vi.fn()} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(suggest).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('goes to the product, not to a search for its name', async () => {
    const user = renderSuggestions('dia');
    await screen.findByRole('option', { name: 'Diamond Halo Ring' });

    await user.click(screen.getByRole('button', { name: 'Diamond Halo Ring' }));

    expect(push).toHaveBeenCalledWith('/product/diamond-halo-ring');
  });

  it('debounces, so a keystroke is not a request', async () => {
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <SearchSuggestions query="d" inputId="site-search" onNavigate={vi.fn()} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SearchSuggestions query="di" inputId="site-search" onNavigate={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(suggest).not.toHaveBeenCalled();
  });
});
