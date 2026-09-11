import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PincodeCheck } from './pincode-check';
import { checkServiceability } from '@/lib/api/shipping';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/shipping', () => ({
  checkServiceability: vi.fn(),
}));

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const check = vi.mocked(checkServiceability);

async function submit(pincode: string) {
  const user = userEvent.setup();
  render(<PincodeCheck />);
  await user.type(screen.getByLabelText('Check delivery to pincode'), pincode);
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

    await user.type(screen.getByLabelText('Check delivery to pincode'), '123');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/valid 6-digit pincode/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Check delivery to pincode'));
    await user.type(screen.getByLabelText('Check delivery to pincode'), '400001');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.queryByText(/valid 6-digit pincode/)).not.toBeInTheDocument());
    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();
  });
});

describe('PincodeCheck — floating (header) variant dismissal', () => {
  // Regression: in the header the result renders as a dropdown, but nothing
  // could close it — not a tap outside, not Escape, not navigating away, since
  // the header lives in a layout that survives client-side navigation. It
  // followed the visitor across the site until a full page reload.

  const deliverable = {
    pincode: '400001',
    deliverable: true,
    estimatedMinDays: 4,
    estimatedMaxDays: 7,
    source: 'ESTIMATED' as const,
  };

  beforeEach(() => {
    check.mockReset();
    check.mockResolvedValue(deliverable);
    pathname = '/';
  });

  async function openFloating() {
    const user = userEvent.setup();
    const view = render(
      <div>
        <PincodeCheck floatingStatus />
        <p>Elsewhere on the page</p>
      </div>,
    );
    await user.type(screen.getByLabelText('Check delivery to pincode'), '400001');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();
    return { user, ...view };
  }

  it('closes from its own close button', async () => {
    const { user } = await openFloating();

    await user.click(screen.getByRole('button', { name: 'Close delivery estimate' }));

    expect(screen.queryByText(/Delivers to 400001/)).not.toBeInTheDocument();
  });

  it('closes on a tap or click outside', async () => {
    await openFloating();

    fireEvent.pointerDown(screen.getByText('Elsewhere on the page'));

    await waitFor(() => expect(screen.queryByText(/Delivers to 400001/)).not.toBeInTheDocument());
  });

  it('closes on Escape', async () => {
    const { user } = await openFloating();

    await user.keyboard('{Escape}');

    expect(screen.queryByText(/Delivers to 400001/)).not.toBeInTheDocument();
  });

  it('closes when the visitor navigates to another page', async () => {
    const { rerender } = await openFloating();

    pathname = '/collections/all';
    rerender(
      <div>
        <PincodeCheck floatingStatus />
        <p>Elsewhere on the page</p>
      </div>,
    );

    await waitFor(() => expect(screen.queryByText(/Delivers to 400001/)).not.toBeInTheDocument());
  });

  it('stays open when pressing inside it, so the pincode can be edited and re-checked', async () => {
    await openFloating();

    fireEvent.pointerDown(screen.getByLabelText('Check delivery to pincode'));
    fireEvent.pointerDown(screen.getByText(/Delivers to 400001/));

    expect(screen.getByText(/Delivers to 400001/)).toBeInTheDocument();
  });

  it('can be dismissed and then checked again', async () => {
    const { user } = await openFloating();
    await user.click(screen.getByRole('button', { name: 'Close delivery estimate' }));

    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();
  });

  it('also dismisses an error, not only a result', async () => {
    const user = userEvent.setup();
    render(<PincodeCheck floatingStatus />);
    await user.type(screen.getByLabelText('Check delivery to pincode'), '123');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/valid 6-digit pincode/)).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByText(/valid 6-digit pincode/)).not.toBeInTheDocument();
  });
});

describe('PincodeCheck — inline (product page) variant', () => {
  beforeEach(() => {
    check.mockReset();
    check.mockResolvedValue({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 4,
      estimatedMaxDays: 7,
      source: 'ESTIMATED',
    });
  });

  it('keeps its result on an outside press — inline text is not a popover', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <PincodeCheck />
        <p>Elsewhere on the page</p>
      </div>,
    );
    await user.type(screen.getByLabelText('Check delivery to pincode'), '400001');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/Delivers to 400001/)).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText('Elsewhere on the page'));
    await user.keyboard('{Escape}');

    expect(screen.getByText(/Delivers to 400001/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close delivery estimate' })).not.toBeInTheDocument();
  });
});
