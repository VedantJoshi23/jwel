'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { OrderSummary } from '@/components/cart/order-summary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createOrder } from '@/lib/api/orders';
import { validateCoupon } from '@/lib/api/coupons';
import { ApiError } from '@/lib/api/client';

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, subtotalMinorUnits, clear } = useCart();
  const { token, isAuthenticated } = useAuth();

  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '' });
  const [couponCode, setCouponCode] = useState('');
  const [discountMinorUnits, setDiscountMinorUnits] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">Please log in to continue to checkout.</p>
        <Button asChild className="mt-5">
          <Link href="/login?next=/checkout">Log in</Link>
        </Button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">Your bag is empty.</p>
        <Button asChild className="mt-5">
          <Link href="/collections/all">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  async function handleApplyCoupon() {
    if (!token || !couponCode.trim()) return;
    try {
      const result = await validateCoupon(token, couponCode.trim(), subtotalMinorUnits);
      setDiscountMinorUnits(result.discountMinorUnits);
      setCouponMessage(`Coupon applied — you saved on this order.`);
    } catch (err) {
      setDiscountMinorUnits(0);
      setCouponMessage(err instanceof ApiError ? err.message : 'Could not apply this coupon.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await createOrder(token, {
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        shippingAddress: address,
        couponCode: couponCode.trim() || undefined,
      });
      clear();
      router.push(`/checkout/confirmation?orderId=${response.orderId}&total=${response.totalMinorUnits}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong placing your order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-6 py-8 lg:px-8">
      <h1 className="mb-8 font-display text-4xl font-bold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="font-display text-2xl font-bold">Shipping address</h2>
          <div className="grid gap-3">
            <label className="text-sm font-medium" htmlFor="line1">
              Address line 1
            </label>
            <Input
              id="line1"
              required
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            />
            <label className="text-sm font-medium" htmlFor="line2">
              Address line 2 (optional)
            </label>
            <Input id="line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium" htmlFor="city">
                  City
                </label>
                <Input id="city" required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="state">
                  State
                </label>
                <Input id="state" required value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
              </div>
            </div>
            <label className="text-sm font-medium" htmlFor="pincode">
              Pincode
            </label>
            <Input
              id="pincode"
              required
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="coupon">
              Coupon code
            </label>
            <div className="mt-1 flex gap-2">
              <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              <Button type="button" variant="secondary" onClick={handleApplyCoupon}>
                Apply
              </Button>
            </div>
            {couponMessage && <p className="mt-2 text-sm text-ink-secondary">{couponMessage}</p>}
          </div>

          <p className="text-xs text-ink-muted">
            Payment is processed via Stripe. This MVP checkout creates the order and a payment intent but
            does not yet render the Stripe Elements card form — see FRONTEND.md for what remains.
          </p>
        </div>

        <div className="space-y-5">
          <h2 className="font-display text-2xl font-bold">Order summary</h2>
          <OrderSummary subtotalMinorUnits={subtotalMinorUnits} discountMinorUnits={discountMinorUnits} />
          {error && (
            <p role="alert" className="text-sm text-feedback-error">
              {error}
            </p>
          )}
          <Button type="submit" size="l" className="w-full" loading={submitting}>
            Finish purchase
          </Button>
        </div>
      </form>
    </div>
  );
}
