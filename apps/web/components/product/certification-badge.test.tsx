import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CertificationBadge } from './certification-badge';

describe('CertificationBadge', () => {
  it('renders the human-readable label for each certification type', () => {
    render(<CertificationBadge type="BIS_HALLMARK" />);
    expect(screen.getByText('BIS Hallmark')).toBeInTheDocument();
  });

  it('renders GIA correctly', () => {
    render(<CertificationBadge type="GIA" />);
    expect(screen.getByText('GIA Certified')).toBeInTheDocument();
  });
});
