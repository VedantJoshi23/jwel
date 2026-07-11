'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createOrder } from '@/lib/api/orders';
import { validateCoupon } from '@/lib/api/coupons';
import { ApiError } from '@/lib/api/client';
import { formatMinorUnits } from '@/lib/money';
import { brand } from '@/lib/brand';
import { getProductStockImage } from '@/lib/jewellery-images';

// `next dev`/`next start` bake NODE_ENV in at build time, so a production
// build can never resolve this to true — matches the backend's own
// `NODE_ENV !== 'production'` gate on MockPaymentProvider (payments.module.ts).
// This flag only controls the toast copy; the mock behavior itself lives
// entirely server-side.
const IS_DEV_MODE = process.env.NODE_ENV !== 'production';

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
        <p className="text-ink-secondary">{brand.cart.emptyMessage}</p>
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
      setCouponMessage('Coupon applied — you saved on this order.');
    } catch (err) {
      setDiscountMinorUnits(0);
      setCouponMessage(err instanceof ApiError ? err.message : 'Could not apply this coupon.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (IS_DEV_MODE) {
      toast.info('No payment gateway is integrated yet', {
        description: 'Dev mode: continuing to the order confirmation without a real charge.',
      });
    }

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

  const finalTotal = subtotalMinorUnits - discountMinorUnits;

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Back link */}
      <Link href="/cart" className="mb-4 flex items-center gap-1.5 text-sm text-ink-primary hover:underline">
        <span>‹</span> Back
      </Link>

      <form onSubmit={handleSubmit} className="grid gap-12 lg:grid-cols-2">

        {/* ── Left column: Items overview ─────────────────────────────── */}
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {brand.checkout.itemsHeadline}
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-secondary">
            {brand.checkout.itemsSubtext}
          </p>

          {/* Line items */}
          <div className="mt-6 space-y-3">
            {lines.map((line) => (
              <div key={line.variantId} className="flex items-center gap-5 border border-border-sale p-5">
                <div className="relative h-[90px] w-[120px] shrink-0 overflow-hidden bg-surface-alt">
                  <Image
                    src={getProductStockImage(line.productSlug)}
                    alt={line.productName}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{line.productName}</p>
                  <p className="mt-1 text-sm text-ink-secondary">Quantity: {line.quantity}</p>
                </div>
                <p className="font-display font-bold">
                  {formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}
                </p>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="mt-6">
            <label className="text-sm font-medium" htmlFor="coupon">
              Coupon code
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              <Button type="button" variant="secondary" onClick={handleApplyCoupon}>
                Apply
              </Button>
            </div>
            {couponMessage && <p className="mt-2 text-sm text-ink-secondary">{couponMessage}</p>}
          </div>

          {/* Shipping */}
          <div className="mt-6">
            <p className="mb-3 font-semibold">{brand.checkout.shippingLabel}</p>
            <div className="flex items-center justify-between rounded-s border border-brand-primary px-4 py-3.5 text-sm">
              <span className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                {brand.checkout.standardDeliveryLabel}
              </span>
              <span>Free</span>
            </div>
          </div>
        </div>

        {/* ── Right column: Payment details ───────────────────────────── */}
        <div>
          <h2 className="font-display text-4xl font-bold tracking-tight">
            {brand.checkout.paymentHeadline}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            {brand.checkout.paymentSubtext}
          </p>

          <div className="mt-6 flex flex-col gap-1">
            {[
              { id: 'email', label: 'Email Address', type: 'email' },
              { id: 'fullname', label: 'Full Name', type: 'text' },
              { id: 'line1', label: 'Address', type: 'text' },
              { id: 'city', label: 'City', type: 'text' },
              { id: 'pincode', label: 'Zip Code', type: 'text' },
            ].map(({ id, label, type }) => (
              <div key={id}>
                <label className="pt-4 block text-sm text-ink-primary" htmlFor={id}>
                  {label}
                </label>
                <div className="border-b border-border-warm pb-2">
                  <input
                    id={id}
                    type={type}
                    required
                    className="w-full bg-transparent py-1 text-sm text-ink-primary outline-none placeholder:text-ink-muted"
                    onChange={(e) => {
                      if (id === 'line1') setAddress((a) => ({ ...a, line1: e.target.value }));
                      if (id === 'city') setAddress((a) => ({ ...a, city: e.target.value }));
                      if (id === 'pincode') setAddress((a) => ({ ...a, pincode: e.target.value }));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Order total */}
          <div className="mt-7 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMinorUnits(subtotalMinorUnits)}</span>
            </div>
            {discountMinorUnits > 0 && (
              <div className="flex justify-between text-feedback-success">
                <span>Discount</span>
                <span>− {formatMinorUnits(discountMinorUnits)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatMinorUnits(finalTotal)}</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-feedback-error">
              {error}
            </p>
          )}

          <Button type="submit" size="l" className="mt-6 w-full" loading={submitting}>
            {brand.checkout.placeCta}
          </Button>
          {IS_DEV_MODE && (
            <p className="mt-2 text-center text-xs text-ink-muted">
              Dev mode — payments are mocked, no real charge will be made.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
