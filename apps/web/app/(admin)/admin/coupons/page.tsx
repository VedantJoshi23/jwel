'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateCoupon, adminDeactivateCoupon, adminListCoupons } from '@/lib/api/admin-coupons';
import { formatMinorUnits } from '@/lib/money';
import type { Coupon, DiscountType } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const EMPTY_FORM = {
  code: '',
  discountType: 'PERCENTAGE' as DiscountType,
  value: '',
  minOrderAmount: '',
  maxRedemptions: '',
  maxRedemptionsPerUser: '',
  validFrom: '',
  validTo: '',
};

// Every rupee field on this page is typed by a human and stored as minor
// units (paise) — the one conversion point, so "did I remember the ×100"
// never has to be re-derived at each call site. Mirrors the same rupee-typed
// -> paise-stored pattern already used for return refund amounts
// (admin/returns/page.tsx) — undefined, not 0, when the field was left blank,
// since 0 and "not set" mean different things to CreateCouponDto (a real
// minOrderAmountMinorUnits of 0 vs. no minimum at all).
function rupeesToMinorUnits(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const rupees = parseFloat(value);
  return Number.isFinite(rupees) && rupees >= 0 ? Math.round(rupees * 100) : NaN;
}

function positiveInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

// `Number.isNaN` is typed to take a `number`, not `number | undefined` — every
// field above is optional, so "was this field even filled in" has to be
// checked before "is what they typed valid".
function isInvalid(n: number | undefined): boolean {
  return n !== undefined && Number.isNaN(n);
}

export default function AdminCouponsPage() {
  const token = useAuthStore((state) => state.token);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    adminListCoupons(token)
      .then(setCoupons)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load coupons'));
  }, [token]);

  useEffect(load, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');

    const isFlat = form.discountType === 'FLAT';
    const value = isFlat ? rupeesToMinorUnits(form.value) : Number(form.value);
    const minOrderAmountMinorUnits = rupeesToMinorUnits(form.minOrderAmount);
    const maxRedemptions = positiveInt(form.maxRedemptions);
    const maxRedemptionsPerUser = positiveInt(form.maxRedemptionsPerUser);

    if (
      value === undefined ||
      Number.isNaN(value) ||
      isInvalid(minOrderAmountMinorUnits) ||
      isInvalid(maxRedemptions) ||
      isInvalid(maxRedemptionsPerUser)
    ) {
      setError('Check the discount value and the optional limits — they must be positive numbers.');
      return;
    }
    if (!isFlat && (value < 0 || value > 100)) {
      setError('A percentage discount must be between 0 and 100.');
      return;
    }

    setCreating(true);
    try {
      await adminCreateCoupon(token, {
        code: form.code,
        discountType: form.discountType,
        value,
        minOrderAmountMinorUnits,
        maxRedemptions,
        maxRedemptionsPerUser,
        validFrom: new Date(form.validFrom).toISOString(),
        validTo: new Date(form.validTo).toISOString(),
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create coupon');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!token) return;
    try {
      await adminDeactivateCoupon(token, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to deactivate coupon');
    }
  }

  const isFlat = form.discountType === 'FLAT';

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">Coupons</h1>
      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card className="mb-8">
        <CardContent>
          <h2 className="mb-4 font-display text-lg font-bold">Create campaign</h2>
          {/*
            Every field carries a real, visible <label> — not just an
            aria-label. Relying on placeholder/aria-label alone was two
            problems, not one: axe rated the two bare date inputs critical
            (a placeholder is not a label — it disappears on focus and isn't
            announced as one), and with no visible label at all, hint text
            like "(optional)" or "(default 1)" had nowhere to live but
            inside the placeholder itself, competing with the actual input
            for a few dozen pixels of a pill-shaped number field until it
            clipped. Labels above each field, hints below it, one uniform
            grid instead of two mismatched ones — this is what the rest of
            the admin's forms already do (see admin/categories).
          */}
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-code">
                  Coupon code
                </label>
                <Input
                  id="coupon-code"
                  placeholder="SHINE10"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-type">
                  Discount type
                </label>
                <Select
                  id="coupon-type"
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountType: e.target.value as DiscountType, value: '' }))
                  }
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FLAT">Flat amount</option>
                  <option value="FIRST_ORDER">First order</option>
                </Select>
              </div>
              <div>
                {/* The visible label *is* the accessible name here (no
                    separate aria-label) — a label that says one thing while
                    a screen reader announces another is its own bug (WCAG
                    2.5.3, Label in Name), which briefly existed in an
                    earlier pass of this fix before landing on this. */}
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-value">
                  {isFlat ? 'Discount amount in rupees' : 'Discount percentage'}
                </label>
                <Input
                  id="coupon-value"
                  type="number"
                  min={0}
                  step={isFlat ? '0.01' : '1'}
                  required
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-valid-from">
                  Valid from
                </label>
                <Input
                  id="coupon-valid-from"
                  type="date"
                  required
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-valid-to">
                  Valid to
                </label>
                <Input
                  id="coupon-valid-to"
                  type="date"
                  required
                  value={form.validTo}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Optional limits — CreateCouponDto has always accepted these;
                they just had no field to type them into, so every coupon
                made through this form silently got maxRedemptionsPerUser's
                API default (1) and no min-order or total-redemption cap. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-min-order">
                  Min order (₹) <span className="text-ink-muted">— optional</span>
                </label>
                <Input
                  id="coupon-min-order"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-max-uses">
                  Max total uses <span className="text-ink-muted">— optional</span>
                </label>
                <Input
                  id="coupon-max-uses"
                  type="number"
                  min={1}
                  step="1"
                  value={form.maxRedemptions}
                  onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="coupon-max-uses-per-customer">
                  Max uses / customer <span className="text-ink-muted">— default 1</span>
                </label>
                <Input
                  id="coupon-max-uses-per-customer"
                  type="number"
                  min={1}
                  step="1"
                  value={form.maxRedemptionsPerUser}
                  onChange={(e) => setForm((f) => ({ ...f, maxRedemptionsPerUser: e.target.value }))}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>

            <Button type="submit" loading={creating}>
              Create coupon
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Limits</th>
                <th className="px-4 py-3">Valid window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono font-medium">{coupon.code}</td>
                  <td className="px-4 py-3">{coupon.discountType}</td>
                  <td className="px-4 py-3">
                    {coupon.discountType === 'FLAT' ? formatMinorUnits(coupon.value) : `${coupon.value}%`}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-secondary">
                    <div>
                      {coupon.minOrderAmountMinorUnits
                        ? `Min order ${formatMinorUnits(coupon.minOrderAmountMinorUnits)}`
                        : 'No minimum order'}
                    </div>
                    <div>
                      {coupon.maxRedemptions ? `${coupon.maxRedemptions} uses total` : 'Unlimited total uses'} ·{' '}
                      {coupon.maxRedemptionsPerUser}/customer
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {new Date(coupon.validFrom).toLocaleDateString()} –{' '}
                    {new Date(coupon.validTo).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={coupon.isActive ? 'success' : 'default'}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {coupon.isActive && (
                      <Button size="s" variant="secondary" onClick={() => handleDeactivate(coupon.id)}>
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-muted">
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
