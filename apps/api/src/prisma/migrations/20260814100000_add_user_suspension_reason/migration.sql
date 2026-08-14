-- Admin-suspension reason + the unsuspend path — DOM-IDENTITY.
--
-- Hand-written, as every migration in this project is (KC-144: prisma
-- migrate dev cannot diff this schema, it fails on products.search_vector,
-- a generated tsvector column Prisma has no representation for). This one
-- has no such pitfall itself, but the convention is kept for consistency.
--
-- `suspension_reason` is set alongside `deleted_at` by an admin suspension
-- and cleared alongside it on unsuspend. There is no separate "suspended"
-- flag: `deleted_at` is currently written only by suspension, so clearing it
-- is a well-defined, safe reversal.

ALTER TABLE "users" ADD COLUMN "suspension_reason" TEXT;
