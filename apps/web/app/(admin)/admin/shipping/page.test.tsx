import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminShippingPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import {
  adminCreatePincodeOverride,
  adminDeletePincodeOverride,
  adminListPincodeOverrides,
  adminUpdatePincodeOverride,
} from '@/lib/api/shipping';
import type { PincodeOverride } from '@/lib/api/types';

vi.mock('@/lib/api/shipping', () => ({
  adminListPincodeOverrides: vi.fn(),
  adminCreatePincodeOverride: vi.fn(),
  adminUpdatePincodeOverride: vi.fn(),
  adminDeletePincodeOverride: vi.fn(),
}));

const list = vi.mocked(adminListPincodeOverrides);
const create = vi.mocked(adminCreatePincodeOverride);
const update = vi.mocked(adminUpdatePincodeOverride);
const remove = vi.mocked(adminDeletePincodeOverride);

function makeOverride(overrides: Partial<PincodeOverride> = {}): PincodeOverride {
  return {
    id: 'o1',
    pincode: '400001',
    deliverable: true,
    estimatedMinDays: null,
    estimatedMaxDays: null,
    note: null,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('AdminShippingPage', () => {
  beforeEach(() => {
    list.mockReset();
    create.mockReset();
    update.mockReset();
    remove.mockReset();
    list.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows an empty state when no exceptions exist yet', async () => {
    render(<AdminShippingPage />);
    expect(await screen.findByText(/No exceptions yet/)).toBeInTheDocument();
  });

  it("disables Add until a valid 6-digit pincode is entered", async () => {
    render(<AdminShippingPage />);
    const addButton = await screen.findByRole('button', { name: 'Add exception' });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '123' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '400001' } });
    expect(addButton).not.toBeDisabled();
  });

  it('creates a deliverable override with an estimate window', async () => {
    create.mockResolvedValue(makeOverride());
    render(<AdminShippingPage />);

    fireEvent.change(await screen.findByLabelText('Pincode'), { target: { value: '400001' } });
    fireEvent.change(screen.getByLabelText('Est. min days'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Est. max days'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add exception' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('token-1', {
        pincode: '400001',
        deliverable: true,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        note: undefined,
      }),
    );
  });

  it('hides the estimate-window inputs when marking a pincode not deliverable', async () => {
    render(<AdminShippingPage />);
    fireEvent.click(await screen.findByLabelText('Deliverable'));
    expect(screen.queryByLabelText('Est. min days')).not.toBeInTheDocument();
  });

  it('lists an existing override with its window', async () => {
    list.mockResolvedValue({
      items: [makeOverride({ estimatedMinDays: 1, estimatedMaxDays: 2 })],
      page: 1,
      pageSize: 50,
      total: 1,
    });
    render(<AdminShippingPage />);
    expect(await screen.findByText(/400001 — Deliverable/)).toBeInTheDocument();
    expect(screen.getByText(/1–2 days \(override\)/)).toBeInTheDocument();
  });

  it('shows an override with no window as using the site default', async () => {
    list.mockResolvedValue({ items: [makeOverride()], page: 1, pageSize: 50, total: 1 });
    render(<AdminShippingPage />);
    expect(await screen.findByText(/Uses site default window/)).toBeInTheDocument();
  });

  it('flipping deliverable off during edit clears the window fields and saves accordingly', async () => {
    list.mockResolvedValue({
      items: [makeOverride({ estimatedMinDays: 1, estimatedMaxDays: 2 })],
      page: 1,
      pageSize: 50,
      total: 1,
    });
    update.mockResolvedValue(makeOverride({ deliverable: false }));
    render(<AdminShippingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    // Two "Deliverable" checkboxes are on screen at once — the always-present
    // create form's, and this row's edit form's — so disambiguate by taking
    // the last one rendered (the edit form's).
    const deliverableCheckboxes = screen.getAllByLabelText('Deliverable');
    fireEvent.click(deliverableCheckboxes[deliverableCheckboxes.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('token-1', 'o1', {
        deliverable: false,
        estimatedMinDays: undefined,
        estimatedMaxDays: undefined,
        note: '',
      }),
    );
  });

  it('deletes an override after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    list.mockResolvedValue({ items: [makeOverride()], page: 1, pageSize: 50, total: 1 });
    remove.mockResolvedValue(undefined);
    render(<AdminShippingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('token-1', 'o1'));
  });

  it('does not delete when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    list.mockResolvedValue({ items: [makeOverride()], page: 1, pageSize: 50, total: 1 });
    render(<AdminShippingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(remove).not.toHaveBeenCalled();
  });

  it('surfaces a load failure as an alert', async () => {
    list.mockRejectedValue(new Error('boom'));
    render(<AdminShippingPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load pincode overrides');
  });
});
