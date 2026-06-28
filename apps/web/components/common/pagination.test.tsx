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

  it('renders a link per page', () => {
    render(<Pagination page={1} pageSize={10} total={35} basePath="/search" searchParams={{}} />);
    expect(screen.getAllByRole('link')).toHaveLength(4); // ceil(35/10) = 4
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
