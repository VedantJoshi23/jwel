import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PincodeCheck } from './pincode-check';
import { checkServiceability } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/shipping', () => ({
  checkServiceability: vi.fn(),
}));

const check = vi.mocked(checkServiceability);

async function submit(pincode: string) {
  const user = userEvent.setup();
  render(<PincodeCheck />);
  await user.type(screen.getByLabelText('Pincode'), pincode);
  await user.click(screen.getByRole('button', { name: 'Check' }));
  return user;
}

describe('PincodeCheck', () => {
  beforeEach(() => {
    check.mockReset();
  });

  it('rejects a malformed pincode locally, without calling the API (FEAT-DELIVERY-ESTIMATE §7.4)', async () => {
    await submit('123');
    expect(await screen.findByText(/valid 6-digit pincode/)).toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
  });

  it('shows a deliverable result with its estimated window', async () => {
    check.mockResolvedValue({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 4,
      estimatedMaxDays: 7,
      source: 'ESTIMATED',
    });

    await submit('400001');
    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();
    expect(screen.getByText(/4–7 business days/)).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith('400001');
  });

  it('discloses that the result is an estimate, never phrasing it as carrier-verified', async () => {
    check.mockResolvedValue({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 4,
      estimatedMaxDays: 7,
      source: 'ESTIMATED',
    });

    await submit('400001');
    expect(await screen.findByText('(Estimated)')).toBeInTheDocument();
  });

  it('shows a non-deliverable result distinctly, without an estimated window', async () => {
    check.mockResolvedValue({
      pincode: '855107',
      deliverable: false,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      source: 'ESTIMATED',
    });

    await submit('855107');
    expect(await screen.findByText(/can't confirm delivery to 855107/)).toBeInTheDocument();
  });

  it('surfaces the API error message when the request fails', async () => {
    check.mockRejectedValue(new ApiError('Something went wrong', 500));

    await submit('400001');
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('falls back to a generic message for a non-ApiError failure', async () => {
    check.mockRejectedValue(new Error('network down'));

    await submit('400001');
    expect(await screen.findByText(/please try again/i)).toBeInTheDocument();
  });

  it('clears a previous error once a valid check succeeds', async () => {
    check.mockResolvedValue({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 4,
      estimatedMaxDays: 7,
      source: 'ESTIMATED',
    });

    const user = userEvent.setup();
    render(<PincodeCheck />);

    await user.type(screen.getByLabelText('Pincode'), '123');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/valid 6-digit pincode/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Pincode'));
    await user.type(screen.getByLabelText('Pincode'), '400001');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.queryByText(/valid 6-digit pincode/)).not.toBeInTheDocument());
    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();
  });
});
