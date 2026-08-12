'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/common/pagination';
import { useAuthStore } from '@/lib/auth-store';
import { adminListQuestions, adminModerateAnswer, adminModerateQuestion, adminPostAnswer } from '@/lib/api/admin-qna';
import type { AdminQuestion } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const PAGE_SIZE = 20;

// useSearchParams() needs a Suspense boundary around it, same shape as
// app/(admin)/admin/products/page.tsx.
export default function AdminQnaPage() {
  return (
    <Suspense>
      <AdminQnaPageInner />
    </Suspense>
  );
}

function AdminQnaPageInner() {
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const parsedPage = Number(searchParams.get('page'));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!token) return;
    adminListQuestions(token, unansweredOnly, page, PAGE_SIZE)
      .then((res) => {
        setQuestions(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load questions'));
  }, [token, unansweredOnly, page]);

  useEffect(load, [load]);

  async function handleModerateQuestion(q: AdminQuestion) {
    if (!token) return;
    setBusyId(q.id);
    setError('');
    try {
      await adminModerateQuestion(token, q.id, !q.isHidden);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update the question');
    } finally {
      setBusyId(null);
    }
  }

  async function handleModerateAnswer(answerId: string, currentlyHidden: boolean) {
    if (!token) return;
    setBusyId(answerId);
    setError('');
    try {
      await adminModerateAnswer(token, answerId, !currentlyHidden);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update the answer');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAnswer(questionId: string) {
    if (!token) return;
    const body = (answerDrafts[questionId] ?? '').trim();
    if (!body) return;
    setBusyId(questionId);
    setError('');
    try {
      await adminPostAnswer(token, questionId, body);
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post the answer');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Questions &amp; Answers</h1>
        {/* An accessible name — without one a screen reader announces the
            current value with no indication of what it filters, same rule
            admin/returns' status filter already follows. */}
        <label htmlFor="qna-unanswered-filter" className="sr-only">
          Filter to unanswered questions
        </label>
        <Select
          id="qna-unanswered-filter"
          value={unansweredOnly ? 'unanswered' : 'all'}
          onChange={(e) => setUnansweredOnly(e.target.value === 'unanswered')}
          className="h-10 w-auto"
        >
          <option value="all">All questions</option>
          <option value="unanswered">Unanswered only</option>
        </Select>
      </div>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <div className="space-y-4">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {q.product.image && (
                  <Image
                    src={q.product.image}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-s object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${q.product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium underline"
                  >
                    {q.product.name}
                  </Link>
                  <p className="mt-1">{q.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Asked by {q.user.name ?? q.user.email} · {q.upvoteCount} upvotes
                    {q.isHidden && (
                      <Badge variant="error" className="ml-2">
                        Hidden
                      </Badge>
                    )}
                  </p>
                  <Button
                    variant="secondary"
                    size="s"
                    className="mt-2"
                    loading={busyId === q.id}
                    onClick={() => handleModerateQuestion(q)}
                  >
                    {q.isHidden ? 'Unhide question' : 'Hide question'}
                  </Button>

                  {q.answers.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-border pt-3">
                      {q.answers.map((a) => (
                        <li key={a.id} className="text-sm">
                          <p>
                            {a.body}
                            {a.isByStore && (
                              <Badge variant="accent" className="ml-2">
                                Store
                              </Badge>
                            )}
                            {a.isHidden && (
                              <Badge variant="error" className="ml-2">
                                Hidden
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-ink-muted">
                            — {a.user.name ?? a.user.email} · {a.upvoteCount} upvotes
                          </p>
                          <Button
                            variant="secondary"
                            size="s"
                            className="mt-1"
                            loading={busyId === a.id}
                            onClick={() => handleModerateAnswer(a.id, a.isHidden)}
                          >
                            {a.isHidden ? 'Unhide answer' : 'Hide answer'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor={`admin-answer-${q.id}`} className="sr-only">
                      Write an answer
                    </label>
                    <textarea
                      id={`admin-answer-${q.id}`}
                      value={answerDrafts[q.id] ?? ''}
                      onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={2}
                      placeholder="Write an answer…"
                      className="w-full rounded-s border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted"
                    />
                    <Button
                      size="s"
                      loading={busyId === q.id}
                      disabled={!(answerDrafts[q.id] ?? '').trim()}
                      onClick={() => handleAnswer(q.id)}
                    >
                      Answer
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {questions.length === 0 && (
          <p className="px-4 py-6 text-center text-ink-muted">
            No {unansweredOnly ? 'unanswered ' : ''}questions.
          </p>
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/qna" searchParams={{}} />
    </div>
  );
}
