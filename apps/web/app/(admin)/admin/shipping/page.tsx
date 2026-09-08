'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/lib/auth-store';
import {
  adminCreatePincodeOverride,
  adminDeletePincodeOverride,
  adminListPincodeOverrides,
  adminUpdatePincodeOverride,
} from '@/lib/api/shipping';
import type { PincodeOverride } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

function parseDays(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `FEAT-DELIVERY-ESTIMATE` — manages the exceptions layered under the
 * pan-India default (`ADR-0024`). The site-wide default window itself is a
 * declared setting (`shipping.default_min_days`/`shipping.default_max_days`)
 * and is edited from `/admin/settings`, not here — this page owns only the
 * per-pincode exception list.
 */
export default function AdminShippingPage() {
  const token = useAuthStore((state) => state.token);
  const [overrides, setOverrides] = useState<PincodeOverride[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Create form
  const [newPincode, setNewPincode] = useState('');
  const [newDeliverable, setNewDeliverable] = useState(true);
  const [newMinDays, setNewMinDays] = useState('');
  const [newMaxDays, setNewMaxDays] = useState('');
  const [newNote, setNewNote] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeliverable, setEditDeliverable] = useState(true);
  const [editMinDays, setEditMinDays] = useState('');
  const [editMaxDays, setEditMaxDays] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    adminListPincodeOverrides(token)
      .then((res) => setOverrides(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pincode overrides'));
  }, [token]);

  useEffect(load, [load]);

  function resetCreateForm() {
    setNewPincode('');
    setNewDeliverable(true);
    setNewMinDays('');
    setNewMaxDays('');
    setNewNote('');
  }

  async function handleCreate() {
    if (!token || !/^[1-9][0-9]{5}$/.test(newPincode)) return;
    setBusy(true);
    setError('');
    try {
      await adminCreatePincodeOverride(token, {
        pincode: newPincode,
        deliverable: newDeliverable,
        estimatedMinDays: newDeliverable ? parseDays(newMinDays) : undefined,
        estimatedMaxDays: newDeliverable ? parseDays(newMaxDays) : undefined,
        note: newNote.trim() || undefined,
      });
      resetCreateForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add pincode override');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(override: PincodeOverride) {
    setEditingId(override.id);
    setEditDeliverable(override.deliverable);
    setEditMinDays(override.estimatedMinDays?.toString() ?? '');
    setEditMaxDays(override.estimatedMaxDays?.toString() ?? '');
    setEditNote(override.note ?? '');
    setError('');
  }

  async function handleSaveEdit(id: string) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdatePincodeOverride(token, id, {
        deliverable: editDeliverable,
        estimatedMinDays: editDeliverable ? parseDays(editMinDays) : undefined,
        estimatedMaxDays: editDeliverable ? parseDays(editMaxDays) : undefined,
        note: editNote.trim(),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update pincode override');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(override: PincodeOverride) {
    if (!token) return;
    if (!window.confirm(`Remove the override for pincode "${override.pincode}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await adminDeletePincodeOverride(token, override.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete pincode override');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Delivery Estimate — Pincode Exceptions</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Every pincode not listed here is treated as deliverable, using the site-wide default window from{' '}
          <span className="font-medium">Settings</span>. Add a pincode here only to mark it undeliverable or to
          override its estimated window. This is an interim, non-carrier-verified estimate (
          <span className="italic">ADR-0024</span>) — not a live courier check.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-feedback-error/10 px-3 py-2 text-sm text-feedback-error">
          {error}
        </p>
      )}

      {/* Create */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Add a pincode exception</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="pincode-new">
                Pincode
              </label>
              <Input
                id="pincode-new"
                inputMode="numeric"
                maxLength={6}
                value={newPincode}
                onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 400001"
              />
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-sm text-ink-secondary">
                <Checkbox checked={newDeliverable} onCheckedChange={(c) => setNewDeliverable(c === true)} />
                Deliverable
              </label>
            </div>
          </div>
          {newDeliverable && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="pincode-new-min">
                  Est. min days
                </label>
                <Input
                  id="pincode-new-min"
                  type="number"
                  min={0}
                  value={newMinDays}
                  onChange={(e) => setNewMinDays(e.target.value)}
                  placeholder="Site default"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="pincode-new-max">
                  Est. max days
                </label>
                <Input
                  id="pincode-new-max"
                  type="number"
                  min={0}
                  value={newMaxDays}
                  onChange={(e) => setNewMaxDays(e.target.value)}
                  placeholder="Site default"
                />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="pincode-new-note">
              Note (optional)
            </label>
            <Input
              id="pincode-new-note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Remote area — no courier coverage"
            />
          </div>
          <Button onClick={handleCreate} loading={busy} disabled={!/^[1-9][0-9]{5}$/.test(newPincode)}>
            Add exception
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-sm font-semibold">Existing exceptions</h2>
          {overrides.length === 0 && (
            <p className="text-sm text-ink-secondary">
              No exceptions yet — every pincode currently falls back to the site default.
            </p>
          )}
          <ul className="divide-y divide-border">
            {overrides.map((override) => (
              <li key={override.id} className="py-3">
                {editingId === override.id ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-ink-secondary sm:col-span-2">
                      <Checkbox checked={editDeliverable} onCheckedChange={(c) => setEditDeliverable(c === true)} />
                      Deliverable
                    </label>
                    {editDeliverable && (
                      <>
                        <Input
                          type="number"
                          min={0}
                          value={editMinDays}
                          onChange={(e) => setEditMinDays(e.target.value)}
                          placeholder="Est. min days"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={editMaxDays}
                          onChange={(e) => setEditMaxDays(e.target.value)}
                          placeholder="Est. max days"
                        />
                      </>
                    )}
                    <Input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Note"
                      className="sm:col-span-2"
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="s" onClick={() => handleSaveEdit(override.id)} loading={busy}>
                        Save
                      </Button>
                      <Button size="s" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {override.pincode} — {override.deliverable ? 'Deliverable' : 'Not deliverable'}
                      </p>
                      <p className="text-xs text-ink-secondary">
                        {override.deliverable
                          ? override.estimatedMinDays != null && override.estimatedMaxDays != null
                            ? `${override.estimatedMinDays}–${override.estimatedMaxDays} days (override)`
                            : 'Uses site default window'
                          : 'Excluded from delivery'}
                        {override.note && ` · ${override.note}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="s" variant="secondary" onClick={() => startEdit(override)}>
                        Edit
                      </Button>
                      <Button size="s" variant="destructive" onClick={() => handleDelete(override)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
