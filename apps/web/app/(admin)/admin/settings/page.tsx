'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adminListSettings, adminUpdateSetting } from '@/lib/api/admin-settings';
import type { SettingView } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

/**
 * FEAT-SETTINGS-STORE's admin surface. Generic by design: the registry
 * (`apps/api/.../settings.registry.ts`) is a flat key/value store, not a
 * bespoke form per setting, so this renders one editor per declared key
 * rather than hardcoding a form for `announcement.text` and another for
 * `returns.window_days`. A control is chosen from the *current* value's
 * runtime type (string / boolean / number) — the only three kinds the
 * registry declares today.
 */

/** Text representation of a setting's value, for the draft input's state. */
function draftValue(value: unknown): string {
  if (typeof value === 'boolean') return String(value);
  return value === null || value === undefined ? '' : String(value);
}

/** Reverses `draftValue`, typed against the setting's own current value. */
function parseDraft(setting: SettingView, raw: string): unknown {
  if (typeof setting.value === 'boolean') return raw === 'true';
  if (typeof setting.value === 'number') return Number(raw);
  return raw;
}

export default function AdminSettingsPage() {
  const token = useAuthStore((state) => state.token);
  const [settings, setSettings] = useState<SettingView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    adminListSettings(token)
      .then((list) => {
        setSettings(list);
        setDrafts(Object.fromEntries(list.map((s) => [s.key, draftValue(s.value)])));
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load settings'));
  }, [token]);

  useEffect(load, [load]);

  function isDirty(setting: SettingView): boolean {
    return drafts[setting.key] !== draftValue(setting.value);
  }

  function handleRevert(setting: SettingView) {
    setDrafts((d) => ({ ...d, [setting.key]: draftValue(setting.value) }));
  }

  async function handleSave(setting: SettingView) {
    if (!token) return;
    setSavingKey(setting.key);
    setSavedKey(null);
    setError('');
    try {
      const value = parseDraft(setting, drafts[setting.key] ?? '');
      const updated = await adminUpdateSetting(token, setting.key, value);
      setSettings((prev) => prev.map((s) => (s.key === setting.key ? updated : s)));
      setDrafts((d) => ({ ...d, [setting.key]: draftValue(updated.value) }));
      setSavedKey(setting.key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to update "${setting.key}"`);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Every admin-editable setting (FEAT-SETTINGS-STORE) — the storefront announcement strip, the return
          window, recommendation thresholds, and anything else declared in the settings registry. A value
          reverts to its default the moment its stored override is gone; nothing here is bespoke per setting.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-feedback-error/10 px-3 py-2 text-sm text-feedback-error">
          {error}
        </p>
      )}

      {!loaded && !error && <p className="text-sm text-ink-secondary">Loading settings…</p>}
      {loaded && settings.length === 0 && (
        <p className="text-sm text-ink-secondary">No settings are declared.</p>
      )}

      <div className="space-y-4">
        {settings.map((setting) => (
          <Card key={setting.key}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-semibold">{setting.key}</p>
                  <p className="mt-1 text-sm text-ink-secondary">{setting.description}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Owner: {setting.owner} · Default: {draftValue(setting.default) || '(empty)'}
                  </p>
                </div>
                <Badge variant={setting.overridden ? 'accent' : 'default'}>
                  {setting.overridden ? 'Overridden' : 'Default'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {typeof setting.value === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm" htmlFor={`setting-${setting.key}`}>
                    <input
                      id={`setting-${setting.key}`}
                      type="checkbox"
                      checked={drafts[setting.key] === 'true'}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [setting.key]: String(e.target.checked) }))
                      }
                    />
                    {drafts[setting.key] === 'true' ? 'On' : 'Off'}
                  </label>
                ) : (
                  <Input
                    id={`setting-${setting.key}`}
                    aria-label={setting.key}
                    type={typeof setting.value === 'number' ? 'number' : 'text'}
                    value={drafts[setting.key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [setting.key]: e.target.value }))}
                    className="max-w-sm"
                  />
                )}
                <Button
                  size="s"
                  onClick={() => handleSave(setting)}
                  loading={savingKey === setting.key}
                  disabled={!isDirty(setting)}
                >
                  Save
                </Button>
                {isDirty(setting) && (
                  <Button size="s" variant="ghost" onClick={() => handleRevert(setting)}>
                    Revert
                  </Button>
                )}
                {savedKey === setting.key && !isDirty(setting) && (
                  <span className="text-xs text-feedback-success">Saved</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
