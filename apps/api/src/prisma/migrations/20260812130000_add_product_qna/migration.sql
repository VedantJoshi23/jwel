-- Product Q&A — DOM-PRODUCT-QA / FEAT-PRODUCT-QA / ADR-0021.
--
-- Hand-written, as every migration in this project must be (KC-144: prisma
-- migrate dev cannot diff this schema, it fails on products.search_vector,
-- a generated tsvector column Prisma has no representation for).
--
-- is_hidden (not a deletedAt soft-delete) is the moderation mechanism on
-- questions/answers — reversible per DOM-PRODUCT-QA Invariants 3/4, the same
-- choice Reviews made with moderation_status instead of soft-delete.

CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "questions_product_id_created_at_idx" ON "questions"("product_id", "created_at" DESC);

CREATE TABLE "answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "answers_question_id_created_at_idx" ON "answers"("question_id", "created_at" ASC);

CREATE TABLE "question_upvotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_upvotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_upvotes_question_id_user_id_key" ON "question_upvotes"("question_id", "user_id");

CREATE TABLE "answer_upvotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "answer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_upvotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "answer_upvotes_answer_id_user_id_key" ON "answer_upvotes"("answer_id", "user_id");

ALTER TABLE "questions" ADD CONSTRAINT "questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_upvotes" ADD CONSTRAINT "question_upvotes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_upvotes" ADD CONSTRAINT "question_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "answer_upvotes" ADD CONSTRAINT "answer_upvotes_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_upvotes" ADD CONSTRAINT "answer_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
