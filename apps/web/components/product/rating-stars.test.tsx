import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingStars } from './rating-stars';

describe('RatingStars', () => {
  it('exposes an accessible label with the rating value', () => {
    render(<RatingStars value={4.5} />);
    expect(screen.getByRole('img', { name: /4\.5 out of 5 stars/ })).toBeInTheDocument();
  });

  it('includes the review count in the accessible label when provided', () => {
    render(<RatingStars value={4} count={12} />);
    expect(screen.getByRole('img', { name: /12 reviews/ })).toBeInTheDocument();
  });

  it('omits review count text from the label when not provided', () => {
    render(<RatingStars value={4} />);
    expect(screen.queryByText(/reviews/)).not.toBeInTheDocument();
  });

  it('renders exactly 5 star icons regardless of rating', () => {
    const { container } = render(<RatingStars value={3} />);
    expect(container.querySelectorAll('svg')).toHaveLength(5);
  });
});
