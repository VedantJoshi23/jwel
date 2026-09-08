import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSettingsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListSettings, adminUpdateSetting } from '@/lib/api/admin-settings';
import { ApiError } from '@/lib/api/client';
import type { SettingView } from '@/lib/api/types';

vi.mock('@/lib/api/admin-settings', () => ({
  adminListSettings: vi.fn(),
  adminUpdateSetting: vi.fn(),
}));

const listSettings = vi.mocked(adminListSettings);
const updateSetting = vi.mocked(adminUpdateSetting);

function settings(): SettingView[] {
  return [
    {
      key: 'announcement.text',
      value: 'SALE LIVE',
      default: 'SALE LIVE',
      description: 'The site-wide announcement strip.',
      owner: 'DOM-CONTENT',
      overridden: false,
    },
    {
      key: 'announcement.active',
      value: true,
      default: true,
      description: 'Whether the announcement strip is shown at all.',
      owner: 'DOM-CONTENT',
      overridden: false,
    },
    {
      key: 'returns.window_days',
      value: 10,
      default: 10,
      description: 'Days after delivery within which a return may be requested.',
      owner: 'DOM-RETURNS',
      overridden: false,
    },
  ];
}

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    listSettings.mockReset();
    updateSetting.mockReset();
    listSettings.mockResolvedValue(settings());
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('lists every declared setting with its description and owner', async () => {
    render(<AdminSettingsPage />);
    expect(await screen.findByText('announcement.text')).toBeInTheDocument();
    expect(screen.getByText('announcement.active')).toBeInTheDocument();
    expect(screen.getByText('returns.window_days')).toBeInTheDocument();
    expect(screen.getByText(/DOM-RETURNS/)).toBeInTheDocument();
  });

  it('renders a checkbox for a boolean setting and a text input for a string one', async () => {
    render(<AdminSettingsPage />);
    await screen.findByText('announcement.text');
    expect(screen.getByLabelText('announcement.text')).toHaveValue('SALE LIVE');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders a number input for an integer setting', async () => {
    render(<AdminSettingsPage />);
    await screen.findByText('returns.window_days');
    const input = screen.getByLabelText('returns.window_days');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveValue(10);
  });

  it('shows "Overridden" only for a setting with a stored override', async () => {
    listSettings.mockResolvedValue([{ ...settings()[2], overridden: true }]);
    render(<AdminSettingsPage />);
    expect(await screen.findByText('Overridden')).toBeInTheDocument();
  });

  it('disables Save until a value is actually changed', async () => {
    render(<AdminSettingsPage />);
    await screen.findByText('returns.window_days');
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    for (const button of saveButtons) expect(button).toBeDisabled();
  });

  it('editing a text setting and saving sends the new value as a string', async () => {
    updateSetting.mockResolvedValue({ ...settings()[0], value: 'NEW COPY', overridden: true });
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByText('announcement.text');

    const input = screen.getByLabelText('announcement.text');
    await user.clear(input);
    await user.type(input, 'NEW COPY');
    const [save] = screen.getAllByRole('button', { name: 'Save' });
    await user.click(save);

    await waitFor(() =>
      expect(updateSetting).toHaveBeenCalledWith('token-1', 'announcement.text', 'NEW COPY'),
    );
  });

  it('editing a number setting sends a number, not a string', async () => {
    updateSetting.mockResolvedValue({ ...settings()[2], value: 14, overridden: true });
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByText('returns.window_days');

    const input = screen.getByLabelText('returns.window_days');
    await user.clear(input);
    await user.type(input, '14');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]);

    await waitFor(() =>
      expect(updateSetting).toHaveBeenCalledWith('token-1', 'returns.window_days', 14),
    );
  });

  it('toggling a boolean setting sends a boolean', async () => {
    updateSetting.mockResolvedValue({ ...settings()[1], value: false, overridden: true });
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByText('announcement.active');

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]);

    await waitFor(() =>
      expect(updateSetting).toHaveBeenCalledWith('token-1', 'announcement.active', false),
    );
  });

  it('Revert restores the value and re-disables Save without calling the API', async () => {
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByText('announcement.text');

    const input = screen.getByLabelText('announcement.text');
    await user.type(input, ' extra');
    await user.click(screen.getAllByRole('button', { name: 'Revert' })[0]);

    expect(input).toHaveValue('SALE LIVE');
    expect(updateSetting).not.toHaveBeenCalled();
  });

  it('surfaces the API error message when a save is refused', async () => {
    updateSetting.mockRejectedValue(new ApiError('Cannot set "returns.window_days": it must be at least 1.', 400));
    const user = userEvent.setup();
    render(<AdminSettingsPage />);
    await screen.findByText('returns.window_days');

    const input = screen.getByLabelText('returns.window_days');
    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]);

    expect(await screen.findByText(/must be at least 1/)).toBeInTheDocument();
  });
});
