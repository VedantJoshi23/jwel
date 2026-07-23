import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductGallery } from './product-gallery';
import type { ProductMedia } from '@/lib/api/types';

function image(id: string, sortOrder: number, url = `https://cdn.example/${id}.jpg`): ProductMedia {
  return { id, storageRef: `local:${id}.jpg`, url, type: 'IMAGE', sortOrder };
}

describe('ProductGallery', () => {
  it('shows the first image as the main image', () => {
    render(<ProductGallery media={[image('m1', 0)]} productId="p1" productName="Gold Ring" />);

    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/m1.jpg')),
    );
  });

  // The seed deliberately ships products with no photography, relying on the
  // stock-photo fallback — so an empty gallery must still render an image.
  it('falls back to a stock image when the product has no media', () => {
    render(<ProductGallery media={[]} productId="p1" productName="Gold Ring" />);

    expect(screen.getByAltText('Gold Ring')).toBeInTheDocument();
  });

  it('orders images by sortOrder, not array order', () => {
    render(
      <ProductGallery
        media={[image('second', 1), image('first', 0)]}
        productId="p1"
        productName="Gold Ring"
      />,
    );

    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/first.jpg')),
    );
  });

  it('ignores non-image media', () => {
    const video: ProductMedia = {
      id: 'v1',
      storageRef: 'local:v.mp4',
      url: 'https://cdn.example/v.mp4',
      type: 'VIDEO',
      sortOrder: 0,
    };

    render(
      <ProductGallery media={[video, image('m1', 1)]} productId="p1" productName="Gold Ring" />,
    );

    // Only one image remains, so no thumbnail strip is rendered.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/m1.jpg')),
    );
  });

  it('renders no thumbnail strip for a single image', () => {
    render(<ProductGallery media={[image('m1', 0)]} productId="p1" productName="Gold Ring" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders one thumbnail per image when there is more than one', () => {
    render(
      <ProductGallery
        media={[image('m1', 0), image('m2', 1)]}
        productId="p1"
        productName="Gold Ring"
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByLabelText('Show image 1 of 2')).toBeInTheDocument();
  });

  it('swaps the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        media={[image('m1', 0), image('m2', 1)]}
        productId="p1"
        productName="Gold Ring"
      />,
    );

    await user.click(screen.getByLabelText('Show image 2 of 2'));

    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/m2.jpg')),
    );
  });

  it('marks the selected thumbnail as current for assistive tech', async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        media={[image('m1', 0), image('m2', 1)]}
        productId="p1"
        productName="Gold Ring"
      />,
    );

    expect(screen.getByLabelText('Show image 1 of 2')).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByLabelText('Show image 2 of 2'));

    expect(screen.getByLabelText('Show image 2 of 2')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Show image 1 of 2')).toHaveAttribute('aria-current', 'false');
  });
});
