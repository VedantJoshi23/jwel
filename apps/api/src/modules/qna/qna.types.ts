export interface QnaAuthor {
  id: string;
  /** `null` when the author is soft-deleted — display anonymously (DOM-PRODUCT-QA Invariant 7). */
  name: string | null;
}

export interface AnswerItem {
  id: string;
  questionId: string;
  body: string;
  createdAt: Date;
  user: QnaAuthor;
  upvoteCount: number;
  /** Only present when the caller is authenticated. */
  upvotedByMe?: boolean;
  /**
   * Derived live from the answerer's *current* role (Invariant 6) — never
   * snapshotted, so this can change on a later read with no data change.
   */
  isByStore: boolean;
}

export interface QuestionItem {
  id: string;
  productId: string;
  body: string;
  createdAt: Date;
  user: QnaAuthor;
  upvoteCount: number;
  upvotedByMe?: boolean;
  answers: AnswerItem[];
}

/**
 * Admin-only shape: real name/email regardless of soft-delete (moderation
 * needs to know who wrote it, same distinction FEAT-ADMIN-REVIEW-MODERATION
 * §7 edge case 3 already draws for Reviews — anonymization is a public
 * display rule, not a moderation one), plus product context so an admin can
 * answer responsibly without leaving the page.
 */
export interface AdminAnswerItem {
  id: string;
  questionId: string;
  body: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string };
  upvoteCount: number;
  isByStore: boolean;
  isHidden: boolean;
}

export interface AdminQuestionItem {
  id: string;
  productId: string;
  body: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string };
  upvoteCount: number;
  isHidden: boolean;
  product: { id: string; name: string; slug: string; image: string | null };
  answers: AdminAnswerItem[];
}
