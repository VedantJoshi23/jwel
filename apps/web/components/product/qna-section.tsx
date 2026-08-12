'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { getProductQuestions } from '@/lib/api/qna';
import { AskQuestionForm } from './ask-question-form';
import { AnswerForm } from './answer-form';
import { QnaUpvoteButton } from './qna-upvote-button';

/**
 * A public, per-product Q&A thread (`FEAT-PRODUCT-QA`) — no separate route,
 * lives directly under the product detail page.
 *
 * Client-fetched rather than part of the page's server-side `Promise.all`
 * the Reviews section uses: `upvotedByMe` genuinely needs to react to login
 * state, the same reason `SaveToWishlist`/`ReviewForm` are client islands
 * rather than server-rendered. No react-query hydration pattern exists
 * anywhere else in this app, so this follows that same precedent rather
 * than introducing one.
 */
export function QnaSection({ productId }: { productId: string }) {
  const { token } = useAuth();

  // Token presence is part of the key — the response shape itself differs
  // (upvotedByMe present or not), so a login/logout mid-session must refetch
  // rather than keep serving the pre-auth-change cache entry. Mutations
  // still invalidate the bare `['questions', productId]` prefix, which
  // matches both boolean variants.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['questions', productId, Boolean(token)],
    queryFn: () => getProductQuestions(productId, 1, 20, token ?? undefined),
  });

  return (
    <div>
      {isLoading && <p className="mt-3 text-sm text-ink-muted">Loading…</p>}
      {isError && (
        <p className="mt-3 text-sm text-feedback-error">Could not load questions right now.</p>
      )}
      {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
        <p className="mt-3 text-sm text-ink-secondary">No questions yet — be the first to ask.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="mt-5 max-w-2xl space-y-6">
          {data.items.map((question) => (
            <li key={question.id} className="border-b border-border pb-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{question.body}</p>
                <QnaUpvoteButton
                  id={question.id}
                  kind="question"
                  productId={productId}
                  count={question.upvoteCount}
                  upvoted={question.upvotedByMe}
                />
              </div>
              <p className="mt-1 text-xs text-ink-muted">Asked by {question.user.name ?? 'Anonymous'}</p>

              {question.answers.length > 0 && (
                <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
                  {question.answers.map((answer) => (
                    <li key={answer.id}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm">
                          {answer.body}
                          {answer.isByStore && (
                            <Badge variant="accent" className="ml-2">
                              Verified by the store
                            </Badge>
                          )}
                        </p>
                        <QnaUpvoteButton
                          id={answer.id}
                          kind="answer"
                          productId={productId}
                          count={answer.upvoteCount}
                          upvoted={answer.upvotedByMe}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">— {answer.user.name ?? 'Anonymous'}</p>
                    </li>
                  ))}
                </ul>
              )}

              <AnswerForm questionId={question.id} productId={productId} />
            </li>
          ))}
        </ul>
      )}

      <AskQuestionForm productId={productId} />
    </div>
  );
}
