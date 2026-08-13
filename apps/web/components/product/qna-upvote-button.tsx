'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { removeAnswerUpvote, removeQuestionUpvote, upvoteAnswer, upvoteQuestion } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import type { PaginatedResult, Question } from '@/lib/api/types';

interface QnaUpvoteButtonProps {
  id: string;
  kind: 'question' | 'answer';
  productId: string;
  count: number;
  upvoted?: boolean;
}

/**
 * Toggle pattern mirrors `SaveToWishlist`, plus one thing that button
 * doesn't need: an optimistic cache write. Without it, there's a real gap
 * between a mutation settling (`isPending` goes false, re-enabling the
 * button) and the invalidated list query's refetch actually landing with the
 * new `upvotedByMe`. A second click inside that gap reads the *old* value
 * from props, so the mutation picks the wrong direction — e.g. a second
 * DELETE after the first already removed the row — and 404s with a
 * confusing "you haven't upvoted this" error on what looked like a normal
 * click. Writing the flip straight into the query cache in `onMutate` closes
 * that window; `onSettled` still invalidates so the server has the last word.
 *
 * `aria-pressed` carries the state rather than colour/fill alone
 * (STD-ACCESSIBILITY rule 6) — and the accessible name states the count in
 * text, since a bare "Upvote" button gives a screen reader no sense of
 * whether this is a popular question worth reading answers to.
 */
export function QnaUpvoteButton({ id, kind, productId, count, upvoted }: QnaUpvoteButtonProps) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['questions', productId, Boolean(token)];

  const mutation = useMutation({
    mutationFn: () => {
      if (kind === 'question') {
        return upvoted ? removeQuestionUpvote(token!, id) : upvoteQuestion(token!, id);
      }
      return upvoted ? removeAnswerUpvote(token!, id) : upvoteAnswer(token!, id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PaginatedResult<Question>>(queryKey);
      if (previous) {
        const delta = upvoted ? -1 : 1;
        const flip = <T extends { id: string; upvoteCount: number; upvotedByMe?: boolean }>(row: T): T =>
          row.id === id ? { ...row, upvoteCount: row.upvoteCount + delta, upvotedByMe: !upvoted } : row;
        queryClient.setQueryData<PaginatedResult<Question>>(queryKey, {
          ...previous,
          items: previous.items.map((question) =>
            kind === 'question'
              ? flip(question)
              : { ...question, answers: question.answers.map(flip) },
          ),
        });
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not update your upvote.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['questions', productId] }),
  });

  const noun = kind === 'question' ? 'this question' : 'this answer';
  const voteWord = count === 1 ? 'vote' : 'votes';

  if (!isAuthenticated) {
    // Read-only for a guest — the count is still meaningful signal, but
    // casting a vote requires being signed in, same gate review submission
    // already uses.
    return (
      <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        {count}
        <span className="sr-only"> upvotes for {noun}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-pressed={Boolean(upvoted)}
      aria-label={`Upvote ${noun} — ${count} ${voteWord}${upvoted ? ', upvoted' : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60',
        upvoted
          ? 'border-brand-accent bg-brand-accent/10 text-brand-accentDeep'
          : 'border-border text-ink-secondary hover:bg-surface-alt',
      )}
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
      {count}
    </button>
  );
}
