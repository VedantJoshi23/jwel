import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SizeFilterDropdown } from './size-filter-dropdown';
import type { SizeOption } from '@/lib/api/types';

const ringSizes: SizeOption[] = Array.from({ length: 21 }, (_, i) => ({
  scheme: 'RING_INDIA',
  value: String(i + 6),
  label: String(i + 6),
}));

describe('SizeFilterDropdown', () => {
  it('shows "Any size" on the collapsed trigger by default', () => {
    render(<SizeFilterDropdown sizeOptions={ringSizes} />);
    expect(screen.getByText('Any size', { selector: 'summary span' })).toBeInTheDocument();
  });

  it('shows the active size\'s label on the collapsed trigger', () => {
    render(<SizeFilterDropdown sizeOptions={ringSizes} defaultSize="18" />);
    expect(screen.getByText('18', { selector: 'summary span' })).toBeInTheDocument();
  });

  it('opens on click, closes automatically once a size is picked', async () => {
    const user = userEvent.setup();
    render(<SizeFilterDropdown sizeOptions={ringSizes} />);
    const details = screen.getByRole('group');

    await user.click(screen.getByText('Any size'));
    expect(details).toHaveAttribute('open');

    await user.click(screen.getByLabelText('18'));
    expect(details).not.toHaveAttribute('open');
  });

  it('the panel caps its own height and scrolls internally, rather than growing the page unboundedly', () => {
    render(<SizeFilterDropdown sizeOptions={ringSizes} />);
    const panel = screen.getByRole('radiogroup').parentElement;
    expect(panel?.className).toContain('max-h-72');
    expect(panel?.className).toContain('overflow-y-auto');
  });

  it('renders every size option, including the ones past what a short viewport would otherwise show', () => {
    render(<SizeFilterDropdown sizeOptions={ringSizes} />);
    expect(screen.getByLabelText('6')).toBeInTheDocument();
    expect(screen.getByLabelText('26')).toBeInTheDocument();
  });
});
