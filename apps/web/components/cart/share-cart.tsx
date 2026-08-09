'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { createCartShare } from '@/lib/api/cart-share';
import { brand } from '@/lib/brand';
import type { CartLine } from '@/hooks/use-cart';

/**
 * Shares the current bag — `DOM-SHOPPING` Invariant 11.
 *
 * The link is created **on demand**, not kept on the cart, and that is the
 * snapshot rule in practice: each share freezes what the bag looked like at
 * that moment. Sharing again later makes a second link with the newer
 * contents, and the first one keeps showing what was actually sent.
 *
 * No account needed. A guest has a bag (Invariant 5) and is arguably the most
 * likely person to be sending one to someone else.
 */
export function ShareCart({ lines }: { lines: CartLine[] }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    setBusy(true);
    setError('');
    try {
      // Gift wrap and note travel with the share now. FEAT-SHAREABLE-CART §10
      // recorded that the API, the snapshot and the shared view all handled
      // them while the sender's browser cart could not supply them — the
      // server cart can, and "which gift options were shared" is half of what
      // Invariant 11 freezes.
      const { token } = await createCartShare(
        lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          giftWrap: line.giftWrap,
          giftNote: line.giftNote ?? undefined,
        })),
      );
      const shareUrl = `${window.location.origin}/cart/shared/${token}`;
      setUrl(shareUrl);
      await navigator.clipboard.writeText(shareUrl).then(
        () => setCopied(true),
        // Clipboard permission can be refused; the link is shown either way,
        // so a refusal must not read as a failure to create it.
        () => setCopied(false),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not create a link just now.');
    } finally {
      setBusy(false);
    }
  }

  if (!url) {
    return (
      <div>
        <Button variant="secondary" size="l" loading={busy} onClick={handleShare}>
          Share this bag
        </Button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-feedback-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full border border-border p-4">
      <p className="text-sm text-ink-secondary">
        Anyone with this link sees these pieces at today’s prices. It does not show them who you
        are, and they cannot change your bag.
      </p>
      <p className="mt-2 break-all font-mono text-xs">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="s" variant="secondary">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`My ${brand.name} bag: ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-sm text-feedback-success">
        {copied ? 'Link copied.' : ''}
      </p>
    </div>
  );
}
