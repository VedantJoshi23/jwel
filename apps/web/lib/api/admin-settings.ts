import { apiFetch } from './client';
import type { SettingView } from './types';

/** Every declared setting (FEAT-SETTINGS-STORE) with its effective value. */
export function adminListSettings(token: string) {
  return apiFetch<SettingView[]>('/admin/settings', { token, cache: 'no-store' });
}

/**
 * Sets one setting. `value` is sent as-is (string, number, or boolean) —
 * `UpdateSettingDto` on the API accepts either a string it parses per the
 * registry's declared type, or a native JSON value.
 */
export function adminUpdateSetting(token: string, key: string, value: unknown) {
  return apiFetch<SettingView>(`/admin/settings/${key}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ value }),
  });
}
