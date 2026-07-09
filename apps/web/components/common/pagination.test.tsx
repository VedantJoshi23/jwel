import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} pageSize={24} total={10} basePath="/search" searchParams={{}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a link per page, plus prev/next arrows, when the page count is small', () => {
    render(<Pagination page={1} pageSize={10} total={35} basePath="/search" searchParams={{}} />);
    // ceil(35/10) = 4 page links + Previous + Next
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });

  it('collapses a large page count behind an ellipsis instead of rendering one link per page', () => {
    render(<Pagination page={1} pageSize={24} total={969} basePath="/collections/rings" searchParams={{}} />);
    // ceil(969/24) = 41 pages, but only first, last, current+siblings, and arrows should render
    const links = screen.getAllByRole('link');
    expect(links.length).toBeLessThan(10);
    expect(screen.getByRole('link', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '41' })).toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('renders Previous/Next arrows pointing at adjacent pages', () => {
    render(<Pagination page={5} pageSize={24} total={969} basePath="/collections/rings" searchParams={{}} />);
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/collections/rings?page=4');
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/collections/rings?page=6');
  });

  it('marks the current page with aria-current', () => {
    render(<Pagination page={2} pageSize={10} total={35} basePath="/search" searchParams={{}} />);
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '1' })).not.toHaveAttribute('aria-current');
  });

  it('preserves existing search params in each page link', () => {
    render(<Pagination page={1} pageSize={10} total={35} basePath="/search" searchParams={{ q: 'ring' }} />);
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/search?q=ring&page=2');
  });

  it('omits empty/undefined search params from the link', () => {
    render(<Pagination page={1} pageSize={10} total={35} basePath="/search" searchParams={{ q: '' }} />);
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/search?page=2');
  });
});
