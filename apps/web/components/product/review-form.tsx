'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/common/field-error';
import { createReview, getMyReview } from '@/lib/api/products';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { reviewSchema, type ReviewFormInput, type ReviewFormValues } from '@/lib/validation/review';

export function ReviewForm({ productId }: { productId: string }) {
  const { token, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [hoverRating, setHoverRating] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormInput, unknown, ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { title: '', body: '' },
  });
  // The raw radio value is a string (see lib/validation/review.ts).
  const rating = Number(watch('rating')) || 0;

  // Same query key `MyReviewStatus` uses — react-query dedupes identical
  // keys across components, so this doesn't cost a second request, and both
  // components stay in sync off one cache entry. This is what replaced the
  // old local `submitted` boolean: that flag reset on every reload, so a
  // visitor who already had a review — pending, approved, or rejected — saw
  // the submission form again and could 409 trying to resubmit. Gating on
  // the real record instead of a local flag fixes that for free.
  const { data: myReview, isLoading } = useQuery({
    queryKey: ['myReview', productId],
    queryFn: () => getMyReview(token!, productId),
    enabled: isAuthenticated && Boolean(token),
  });

  if (!isAuthenticated) {
    return (
      <p className="mt-6 text-sm text-ink-secondary">
        {/* Back to *this* product after logging in — this was a fixed
            `next=/product`, which is not a page, so it landed on a 404. */}
        <Link href={`/login?next=${encodeURIComponent(pathname ?? '/')}`} className="font-medium underline">
          Log in
        </Link>{' '}
        to write a review.
      </p>
    );
  }

  // Loading and "already reviewed" both render nothing here — a review that
  // exists in any state is `MyReviewStatus`'s surface to show, immediately
  // above this in the page, not this component's.
  if (isLoading || myReview) {
    return null;
  }

  async function onValid(values: ReviewFormValues) {
    if (!token) return;

    try {
      await createReview(token, {
        productId,
        rating: values.rating,
        // An empty title is "no title", not a title that is an empty string.
        title: values.title?.trim() || undefined,
        body: values.body.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['myReview', productId] });
      toast.success('Review submitted', { description: 'It will appear once approved by our team.' });
    } catch (err) {
      const message =
        err instanceof ApiError && err.statusCode === 409
          ? 'You have already reviewed this product.'
          : err instanceof ApiError
            ? err.message
            : 'Something went wrong submitting your review.';
      toast.error(message);
      // A 409 means a review already exists server-side despite the cache
      // saying otherwise (a second tab, most likely) — refetch so this form
      // hides itself instead of staying up to invite a second failed attempt.
      if (err instanceof ApiError && err.statusCode === 409) {
        await queryClient.invalidateQueries({ queryKey: ['myReview', productId] });
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      noValidate
      className="mt-6 max-w-md space-y-4 border-t border-border pt-6"
    >
      <h3 className="font-display text-lg font-bold">Write a review</h3>

      {/*
        Native radios rather than five role="radio" buttons. The buttons were
        five separate tab stops with no arrow-key support, which is not how a
        radio group behaves; native inputs give one tab stop, arrow keys, and
        form semantics for free. The stars are the labels.
      */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((starValue) => (
            <span key={starValue}>
              <input
                type="radio"
                id={`review-rating-${starValue}`}
                value={starValue}
                {...register('rating')}
                aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
                aria-describedby={errors.rating ? 'review-rating-error' : undefined}
                className="peer sr-only"
              />
              <label
                htmlFor={`review-rating-${starValue}`}
                onMouseEnter={() => setHoverRating(starValue)}
                className="block cursor-pointer rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary peer-focus-visible:ring-offset-2"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    'h-6 w-6',
                    starValue <= (hoverRating || rating) ? 'fill-brand-accent text-brand-accent' : 'text-border',
                  )}
                />
              </label>
            </span>
          ))}
        </div>
        <FieldError id="review-rating-error" message={errors.rating?.message} />
      </fieldset>

      <div>
        <label htmlFor="review-title" className="mb-1.5 block text-sm font-medium">
          Title (optional)
        </label>
        <Input
          id="review-title"
          {...register('title')}
          maxLength={120}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'review-title-error' : undefined}
        />
        <FieldError id="review-title-error" message={errors.title?.message} />
      </div>

      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-sm font-medium">
          Your review
        </label>
        <textarea
          id="review-body"
          {...register('body')}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? 'review-body-error' : undefined}
          rows={4}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted aria-[invalid]:border-feedback-error"
        />
        <FieldError id="review-body-error" message={errors.body?.message} />
      </div>

      {/* No longer disabled until complete: a disabled button is unfocusable
          and says nothing about why. Submitting early now names what is missing. */}
      <Button type="submit" loading={isSubmitting}>
        Submit review
      </Button>
    </form>
  );
}
