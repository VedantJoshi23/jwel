import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RazorpayCheckoutError,
  loadRazorpayCheckout,
  openRazorpayCheckout,
} from './razorpay-checkout';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

function scriptTag() {
  return document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
}

describe('loadRazorpayCheckout', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as any).Razorpay;
  });

  it('injects the Razorpay script and resolves with the constructor once it loads', async () => {
    const promise = loadRazorpayCheckout();

    const tag = scriptTag();
    expect(tag).not.toBeNull();
    expect(tag!.async).toBe(true);

    const Ctor = vi.fn();
    (window as any).Razorpay = Ctor;
    tag!.onload!(new Event('load'));

    await expect(promise).resolves.toBe(Ctor);
  });

  it('resolves immediately without injecting a second tag when already loaded', async () => {
    const Ctor = vi.fn();
    (window as any).Razorpay = Ctor;

    await expect(loadRazorpayCheckout()).resolves.toBe(Ctor);
    expect(scriptTag()).toBeNull();
  });

  // Two rapid submits must not append two tags — they would race, and one
  // could resolve before either script had actually defined window.Razorpay.
  it('reuses an in-flight script tag rather than appending a second', async () => {
    const first = loadRazorpayCheckout();
    const second = loadRazorpayCheckout();

    expect(document.querySelectorAll(`script[src="${SCRIPT_URL}"]`)).toHaveLength(1);

    const Ctor = vi.fn();
    (window as any).Razorpay = Ctor;
    const tag = scriptTag()!;
    tag.onload!(new Event('load'));
    tag.dispatchEvent(new Event('load'));

    await expect(first).resolves.toBe(Ctor);
    await expect(second).resolves.toBe(Ctor);
  });

  it('rejects with a shopper-readable error when the script fails to load', async () => {
    const promise = loadRazorpayCheckout();
    scriptTag()!.onerror!(new Event('error'));

    await expect(promise).rejects.toBeInstanceOf(RazorpayCheckoutError);
    await expect(promise).rejects.toThrow(/could not reach the payment gateway/i);
  });

  it('rejects when an in-flight tag errors', async () => {
    const first = loadRazorpayCheckout();
    const second = loadRazorpayCheckout();
    const tag = scriptTag()!;

    tag.onerror!(new Event('error'));
    tag.dispatchEvent(new Event('error'));

    await expect(first).rejects.toBeInstanceOf(RazorpayCheckoutError);
    await expect(second).rejects.toBeInstanceOf(RazorpayCheckoutError);
  });

  // A load event that leaves window.Razorpay undefined means the script was
  // served but is not usable — treating that as success would blow up later
  // with a less comprehensible error.
  it('rejects if the script loads without defining window.Razorpay', async () => {
    const promise = loadRazorpayCheckout();
    scriptTag()!.onload!(new Event('load'));

    await expect(promise).rejects.toBeInstanceOf(RazorpayCheckoutError);
  });
});

describe('openRazorpayCheckout', () => {
  const checkout = { keyId: 'rzp_test_key', orderId: 'order_1', simulated: false };
  const baseOptions = { checkout, amountMinorUnits: 8500000, description: 'Order o1' };

  function fakeRazorpay() {
    const captured: { options?: any; listeners: Record<string, (r: unknown) => void> } = {
      listeners: {},
    };
    const Ctor = vi.fn().mockImplementation((options: any) => {
      captured.options = options;
      return {
        open: vi.fn(),
        on: (event: string, handler: (r: unknown) => void) => {
          captured.listeners[event] = handler;
        },
      };
    });
    return { Ctor: Ctor as any, captured };
  }

  afterEach(() => vi.restoreAllMocks());

  it('opens the modal with the public key and server-created order id', async () => {
    const { Ctor, captured } = fakeRazorpay();

    void openRazorpayCheckout(Ctor, baseOptions);

    expect(captured.options.key).toBe('rzp_test_key');
    expect(captured.options.order_id).toBe('order_1');
    expect(captured.options.amount).toBe(8500000);
    expect(captured.options.currency).toBe('INR');
  });

  it('resolves with the signed handler payload on success', async () => {
    const { Ctor, captured } = fakeRazorpay();
    const promise = openRazorpayCheckout(Ctor, baseOptions);

    captured.options.handler({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });

    await expect(promise).resolves.toEqual({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
  });

  // Dismissal is not an error state to hide — the caller tells the shopper
  // their order is saved and unpaid.
  it('rejects when the shopper dismisses the modal', async () => {
    const { Ctor, captured } = fakeRazorpay();
    const promise = openRazorpayCheckout(Ctor, baseOptions);

    captured.options.modal.ondismiss();

    await expect(promise).rejects.toBeInstanceOf(RazorpayCheckoutError);
    await expect(promise).rejects.toThrow(/cancelled/i);
  });

  it('rejects with the gateway’s own description on payment.failed', async () => {
    const { Ctor, captured } = fakeRazorpay();
    const promise = openRazorpayCheckout(Ctor, baseOptions);

    captured.listeners['payment.failed']({ error: { description: 'Card declined by issuer' } });

    await expect(promise).rejects.toThrow('Card declined by issuer');
  });

  it('falls back to a generic message when payment.failed carries no description', async () => {
    const { Ctor, captured } = fakeRazorpay();
    const promise = openRazorpayCheckout(Ctor, baseOptions);

    captured.listeners['payment.failed']({});

    await expect(promise).rejects.toThrow(/could not be completed/i);
  });

  it('passes prefill through, and defaults it to an empty object', async () => {
    const withPrefill = fakeRazorpay();
    void openRazorpayCheckout(withPrefill.Ctor, {
      ...baseOptions,
      prefill: { email: 'a@b.com' },
    });
    expect(withPrefill.captured.options.prefill).toEqual({ email: 'a@b.com' });

    const without = fakeRazorpay();
    void openRazorpayCheckout(without.Ctor, baseOptions);
    expect(without.captured.options.prefill).toEqual({});
  });
});
