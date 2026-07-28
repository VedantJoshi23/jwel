import type { CheckoutHandle } from './api/types';

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/** The subset of Razorpay's handler payload this app acts on. */
export interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export class RazorpayCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayCheckoutError';
  }
}

/**
 * Injects Razorpay's Checkout script once and resolves when it is usable.
 *
 * Loaded on demand rather than in the root layout: it is only needed by the
 * one checkout submit, and a payment-gateway script on every page of the
 * storefront is a cost every shopper pays for a page almost none of them
 * reach. Re-entrant — a second call reuses the tag already in the document.
 */
export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new RazorpayCheckoutError('Razorpay Checkout can only load in a browser'));
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  return new Promise((resolve, reject) => {
    const fail = () =>
      reject(
        new RazorpayCheckoutError(
          'Could not reach the payment gateway. Check your connection and try again.',
        ),
      );

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_URL}"]`,
    );
    if (existing) {
      // Mid-flight from an earlier attempt: wait on it rather than adding a
      // second tag, which would race and could resolve before either loads.
      existing.addEventListener('load', () =>
        window.Razorpay ? resolve(window.Razorpay) : fail(),
      );
      existing.addEventListener('error', fail);
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : fail());
    script.onerror = fail;
    document.body.appendChild(script);
  });
}

export interface OpenCheckoutOptions {
  checkout: CheckoutHandle;
  amountMinorUnits: number;
  /** Shown in the modal so the shopper can see what they are paying for. */
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

/**
 * Opens the hosted Checkout modal and settles once the shopper finishes.
 *
 * Resolves with the signed handler payload on success. Rejects if the shopper
 * dismisses the modal or the gateway reports a failure — the caller
 * distinguishes those by the error, and in neither case is the order paid.
 *
 * Nothing this resolves with is trusted on its own: the signature is verified
 * server-side, and the webhook remains the authority (SECURITY.md §4).
 */
export function openRazorpayCheckout(
  Razorpay: RazorpayConstructor,
  options: OpenCheckoutOptions,
): Promise<RazorpayHandlerResponse> {
  return new Promise((resolve, reject) => {
    const instance = new Razorpay({
      key: options.checkout.keyId,
      order_id: options.checkout.orderId,
      // Razorpay authoritatively takes the amount from the server-created
      // order; this is passed only so the modal renders the right figure
      // before that loads. A tampered value here cannot change what is charged.
      amount: options.amountMinorUnits,
      currency: 'INR',
      name: 'Elysian',
      description: options.description,
      prefill: options.prefill ?? {},
      handler: (response: RazorpayHandlerResponse) => resolve(response),
      modal: {
        ondismiss: () =>
          reject(new RazorpayCheckoutError('Payment was cancelled before it completed.')),
      },
    } as Record<string, unknown>);

    instance.on('payment.failed', (response: unknown) => {
      const description = (response as { error?: { description?: string } })?.error?.description;
      reject(new RazorpayCheckoutError(description ?? 'The payment could not be completed.'));
    });

    instance.open();
  });
}
