import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductGallery } from './product-gallery';
import type { ProductMedia } from '@/lib/api/types';

function image(id: string, sortOrder: number, url = `https://cdn.example/${id}.jpg`): ProductMedia {
  return { id, storageRef: `local:${id}.jpg`, url, type: 'IMAGE', sortOrder };
}

function video(id: string, sortOrder: number, url = `https://cdn.example/${id}.mp4`): ProductMedia {
  return { id, storageRef: `local:${id}.mp4`, url, type: 'VIDEO', sortOrder };
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

  it('orders media by sortOrder, not array order', () => {
    render(<ProductGallery media={[image('second', 1), image('first', 0)]} productId="p1" productName="Gold Ring" />);

    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/first.jpg')),
    );
  });

  // FEAT-PRODUCT-VIDEO-MEDIA — media no longer filters out VIDEO items; the
  // gallery renders whatever is at sortOrder 0, image or video.
  it('renders a video as the main item when it is first in sort order', () => {
    render(<ProductGallery media={[video('v1', 0), image('m1', 1)]} productId="p1" productName="Gold Ring" />);

    expect(screen.queryByAltText('Gold Ring')).not.toBeInTheDocument();
    const mainVideo = document.querySelector('video');
    expect(mainVideo).toHaveAttribute('src', 'https://cdn.example/v1.mp4');
  });

  it('includes a video in the thumbnail strip alongside images', () => {
    render(<ProductGallery media={[image('m1', 0), video('v1', 1)]} productId="p1" productName="Gold Ring" />);

    expect(screen.getByLabelText('Show image 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Play video 2 of 2')).toBeInTheDocument();
  });

  it('renders no thumbnail strip for a single image', () => {
    render(<ProductGallery media={[image('m1', 0)]} productId="p1" productName="Gold Ring" />);

    expect(screen.queryByLabelText(/Show image|Play video/)).not.toBeInTheDocument();
  });

  it('renders one thumbnail per item when there is more than one', () => {
    render(<ProductGallery media={[image('m1', 0), image('m2', 1)]} productId="p1" productName="Gold Ring" />);

    expect(screen.getAllByLabelText(/Show image/)).toHaveLength(2);
    expect(screen.getByLabelText('Show image 1 of 2')).toBeInTheDocument();
  });

  it('swaps the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductGallery media={[image('m1', 0), image('m2', 1)]} productId="p1" productName="Gold Ring" />);

    await user.click(screen.getByLabelText('Show image 2 of 2'));

    expect(screen.getByAltText('Gold Ring')).toHaveAttribute(
      'src',
      expect.stringContaining(encodeURIComponent('https://cdn.example/m2.jpg')),
    );
  });

  it('marks the selected thumbnail as current for assistive tech', async () => {
    const user = userEvent.setup();
    render(<ProductGallery media={[image('m1', 0), image('m2', 1)]} productId="p1" productName="Gold Ring" />);

    expect(screen.getByLabelText('Show image 1 of 2')).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByLabelText('Show image 2 of 2'));

    expect(screen.getByLabelText('Show image 2 of 2')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Show image 1 of 2')).toHaveAttribute('aria-current', 'false');
  });

  it('offers a zoom trigger on the main image but not on a video', () => {
    const { rerender } = render(<ProductGallery media={[image('m1', 0)]} productId="p1" productName="Gold Ring" />);
    expect(screen.getByLabelText('Open full-screen view to zoom in')).toBeInTheDocument();

    rerender(<ProductGallery media={[video('v1', 0)]} productId="p1" productName="Gold Ring" />);
    expect(screen.queryByLabelText('Open full-screen view to zoom in')).not.toBeInTheDocument();
  });
});
