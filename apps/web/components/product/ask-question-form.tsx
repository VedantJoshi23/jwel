'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/common/field-error';
import { askQuestion } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';
import { questionSchema, type QuestionFormValues } from '@/lib/validation/question';

export function AskQuestionForm({ productId }: { productId: string }) {
  const { token, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { body: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: QuestionFormValues) => askQuestion(token!, productId, values.body.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', productId] });
      reset();
      toast.success('Question posted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong posting your question.');
    },
  });

  if (!isAuthenticated) {
    return (
      <p className="mt-6 text-sm text-ink-secondary">
        {/* Back to *this* product after logging in. This used to be a fixed
            `next=/product`, which is not a page, so logging in to ask a
            question dropped the customer on a 404 instead. */}
        <Link href={`/login?next=${encodeURIComponent(pathname ?? '/')}`} className="font-medium underline">
          Log in
        </Link>{' '}
        to ask a question.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="mt-6 max-w-md space-y-3 border-t border-border pt-6"
    >
      <h3 className="font-display text-lg font-bold">Ask a question</h3>
      <label htmlFor="qna-ask-body" className="sr-only">
        Your question
      </label>
      <textarea
        id="qna-ask-body"
        {...register('body')}
        aria-invalid={errors.body ? true : undefined}
        aria-describedby={errors.body ? 'qna-ask-body-error' : undefined}
        rows={3}
        placeholder="Ask about sizing, materials, care…"
        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted aria-[invalid]:border-feedback-error"
      />
      <FieldError id="qna-ask-body-error" message={errors.body?.message} />
      <Button type="submit" loading={mutation.isPending}>
        Post question
      </Button>
    </form>
  );
}
