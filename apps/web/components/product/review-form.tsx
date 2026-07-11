'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createReview } from '@/lib/api/products';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export function ReviewForm({ productId }: { productId: string }) {
  const { token, isAuthenticated } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isAuthenticated) {
    return (
      <p className="mt-6 text-sm text-ink-secondary">
        <Link href={`/login?next=/product`} className="font-medium underline">
          Log in
        </Link>{' '}
        to write a review.
      </p>
    );
  }

  if (submitted) {
    return (
      <p role="status" className="mt-6 text-sm text-feedback-success">
        Thanks — your review has been submitted and is awaiting moderation.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || rating === 0 || !body.trim()) return;

    setSubmitting(true);
    try {
      await createReview(token, { productId, rating, title: title.trim() || undefined, body: body.trim() });
      setSubmitted(true);
      toast.success('Review submitted', { description: 'It will appear once approved by our team.' });
    } catch (err) {
      const message =
        err instanceof ApiError && err.statusCode === 409
          ? 'You have already reviewed this product.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong submitting your review.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4 border-t border-border pt-6">
      <h3 className="font-display text-lg font-bold">Write a review</h3>

      <div>
        <p className="mb-1.5 text-sm font-medium">Your rating</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {Array.from({ length: 5 }).map((_, i) => {
            const starValue = i + 1;
            return (
              <button
                key={starValue}
                type="button"
                role="radio"
                aria-checked={rating === starValue}
                aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
                onMouseEnter={() => setHoverRating(starValue)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(starValue)}
              >
                <Star
                  className={cn(
                    'h-6 w-6',
                    starValue <= (hoverRating || rating)
                      ? 'fill-brand-accent text-brand-accent'
                      : 'text-border',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="review-title" className="mb-1.5 block text-sm font-medium">
          Title (optional)
        </label>
        <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </div>

      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-sm font-medium">
          Your review
        </label>
        <textarea
          id="review-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-s border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted"
        />
      </div>

      <Button type="submit" disabled={rating === 0 || !body.trim()} loading={submitting}>
        Submit review
      </Button>
    </form>
  );
}
