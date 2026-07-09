import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialLoginButtons } from './social-login-buttons';
import { API_URL } from '@/lib/api/client';

describe('SocialLoginButtons', () => {
  it('renders one link per provider, each pointing at the backend OAuth initiation route', () => {
    render(<SocialLoginButtons />);

    expect(screen.getByRole('link', { name: /Continue with Google/i })).toHaveAttribute(
      'href',
      `${API_URL}/auth/google`,
    );
    expect(screen.getByRole('link', { name: /Continue with Meta/i })).toHaveAttribute(
      'href',
      `${API_URL}/auth/facebook`,
    );
    expect(screen.getByRole('link', { name: /Continue with Apple/i })).toHaveAttribute(
      'href',
      `${API_URL}/auth/apple`,
    );
  });

  it('renders exactly 3 provider links, no more, no fewer', () => {
    render(<SocialLoginButtons />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
});
