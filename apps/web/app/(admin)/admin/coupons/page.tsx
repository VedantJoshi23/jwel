'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateCoupon, adminDeactivateCoupon, adminListCoupons } from '@/lib/api/admin-coupons';
import type { Coupon, DiscountType } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const EMPTY_FORM = {
  code: '',
  discountType: 'PERCENTAGE' as DiscountType,
  value: '',
  validFrom: '',
  validTo: '',
};

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
    setCreating(true);
    setError('');
    try {
      await adminCreateCoupon(token, {
        code: form.code,
        discountType: form.discountType,
        value: Number(form.value),
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

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">Coupons</h1>
      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card className="mb-8">
        <CardContent>
          <h2 className="mb-4 font-display text-lg font-bold">Create campaign</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Input
              placeholder="CODE"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
            <select
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as DiscountType }))}
              className="h-11 rounded-s border border-border bg-surface px-3 text-sm"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat (minor units)</option>
              <option value="FIRST_ORDER">First order</option>
            </select>
            <Input
              type="number"
              placeholder="Value"
              required
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
            <Input
              type="date"
              required
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            />
            <Input
              type="date"
              required
              value={form.validTo}
              onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
            />
            <Button type="submit" loading={creating} className="col-span-2 lg:col-span-1">
              Create
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
                    {coupon.discountType === 'FLAT' ? coupon.value : `${coupon.value}%`}
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
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
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
