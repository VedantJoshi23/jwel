'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { postAnswer } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';

/**
 * Collapsed behind an "Answer" toggle rather than always-open — a wall of
 * empty textareas, one per question, is worse than one extra click.
 */
export function AnswerForm({ questionId, productId }: { questionId: string; productId: string }) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: () => postAnswer(token!, questionId, body.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', productId] });
      setBody('');
      setIsOpen(false);
      toast.success('Answer posted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong posting your answer.');
    },
  });

  if (!isAuthenticated) {
    return (
      <p className="mt-3 text-sm text-ink-secondary">
        <Link href="/login?next=/product" className="font-medium underline">
          Log in
        </Link>{' '}
        to answer.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="secondary" size="s" className="mt-3" onClick={() => setIsOpen(true)}>
        Answer
      </Button>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label htmlFor={`qna-answer-${questionId}`} className="sr-only">
        Your answer
      </label>
      <textarea
        id={`qna-answer-${questionId}`}
        required
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Write an answer…"
        className="w-full rounded-s border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted"
      />
      <div className="flex gap-2">
        <Button type="submit" size="s" disabled={!body.trim()} loading={mutation.isPending}>
          Post answer
        </Button>
        <Button type="button" size="s" variant="secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
