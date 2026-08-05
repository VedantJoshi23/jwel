import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollectionView } from './collection-view';
import type { CollectionWithProducts, Product } from '@/lib/api/types';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Amara Ring',
    slug: 'amara-ring',
    description: 'A ring.',
    status: 'PUBLISHED',
    certificationType: null,
    avgRating: '4.50',
    ratingCount: 12,
    category: { id: 'cat1', name: 'Rings', slug: 'rings', parentId: null },
    variants: [
      {
        id: 'v1',
        sku: 'AM-1',
        metal: 'GOLD',
        purity: '22K',
        size: null,
        weightGrams: '4.2',
        basePriceMinorUnits: 4500000,
      } as Product['variants'][number],
    ],
    media: [],
    ...overrides,
  };
}

function collection(overrides: Partial<CollectionWithProducts> = {}): CollectionWithProducts {
  return {
    id: 'c1',
    name: 'Diwali Edit',
    slug: 'diwali-edit',
    type: 'SEASONAL',
    description: 'Pieces chosen for the festival of lights.',
    heroImageRef: null,
    heroImageUrl: null,
    isFeatured: true,
    startsAt: null,
    endsAt: null,
    products: { items: [product()], page: 1, pageSize: 12, total: 1 },
    ...overrides,
  };
}

describe('CollectionView', () => {
  it('renders the collection name as the page heading', () => {
    render(<CollectionView collection={collection()} searchParams={{}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Diwali Edit');
  });

  it('renders the description when there is one', () => {
    render(<CollectionView collection={collection()} searchParams={{}} />);
    expect(screen.getByText('Pieces chosen for the festival of lights.')).toBeInTheDocument();
  });

  it('omits the description block entirely when there is none', () => {
    render(<CollectionView collection={collection({ description: null })} searchParams={{}} />);
    expect(screen.queryByText(/festival of lights/)).not.toBeInTheDocument();
  });

  it('lists the collection products', () => {
    render(<CollectionView collection={collection()} searchParams={{}} />);
    expect(screen.getByText('Amara Ring')).toBeInTheDocument();
  });

  it('shows a curation message rather than "no products found" when empty', () => {
    const empty = collection({ products: { items: [], page: 1, pageSize: 12, total: 0 } });
    render(<CollectionView collection={empty} searchParams={{}} />);
    // A collection with nothing in it is being assembled, not a failed
    // search — the category view's wording would be wrong here.
    expect(screen.getByText(/being put together/i)).toBeInTheDocument();
  });

  // A collection is already a merchandiser's chosen narrowing, in a chosen
  // order. Offering "sort by price" over it would destroy the only thing that
  // made it a collection.
  it('renders no filter or sort controls', () => {
    render(<CollectionView collection={collection()} searchParams={{}} />);
    expect(screen.queryByLabelText('Filters')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('uses the uploaded hero image when one is set', () => {
    const withHero = collection({
      heroImageRef: 'local:collections/a.jpg',
      heroImageUrl: 'https://cdn.example/hero.jpg',
    });
    const { container } = render(<CollectionView collection={withHero} searchParams={{}} />);
    const hero = container.querySelector('img[alt=""]');
    expect(hero?.getAttribute('src')).toContain('cdn.example');
  });

  it('falls back to a placeholder hero rather than collapsing the layout', () => {
    const { container } = render(<CollectionView collection={collection()} searchParams={{}} />);
    expect(container.querySelector('img[alt=""]')).toBeInTheDocument();
  });

  it('paginates against the collection slug, not a category', () => {
    const many = collection({ products: { items: [product()], page: 1, pageSize: 12, total: 40 } });
    render(<CollectionView collection={many} searchParams={{}} />);
    const next = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.includes('page=2'));
    expect(next?.getAttribute('href')).toContain('/collections/diwali-edit');
  });
});
