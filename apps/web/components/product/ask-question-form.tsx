'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { askQuestion } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';

export function AskQuestionForm({ productId }: { productId: string }) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: () => askQuestion(token!, productId, body.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', productId] });
      setBody('');
      toast.success('Question posted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong posting your question.');
    },
  });

  if (!isAuthenticated) {
    return (
      <p className="mt-6 text-sm text-ink-secondary">
        <Link href="/login?next=/product" className="font-medium underline">
          Log in
        </Link>{' '}
        to ask a question.
      </p>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-3 border-t border-border pt-6">
      <h3 className="font-display text-lg font-bold">Ask a question</h3>
      <label htmlFor="qna-ask-body" className="sr-only">
        Your question
      </label>
      <textarea
        id="qna-ask-body"
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Ask about sizing, materials, care…"
        className="w-full rounded-s border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted"
      />
      <Button type="submit" disabled={!body.trim()} loading={mutation.isPending}>
        Post question
      </Button>
    </form>
  );
}
