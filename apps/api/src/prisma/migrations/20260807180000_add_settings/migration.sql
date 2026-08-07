-- FEAT-SETTINGS-STORE — admin-editable configuration.
--
-- Hand-authored: `prisma migrate dev` cannot diff this schema at all. It fails
-- with 42601 trying to alter the generated `products.search_vector` column —
-- the Prisma-invisible-schema cost recorded in DISC-005 (KC-144). Every
-- migration on this schema must be written by hand (STD-DATABASE r7).

-- CreateTable
-- `value` is TEXT for every setting: a typed column per setting would mean a
-- migration per setting, defeating the purpose of a general mechanism. The
-- type is enforced by the registry in modules/settings/settings.registry.ts.
--
-- A row exists only for an OVERRIDDEN setting. Defaults live in code, so a
-- fresh environment needs no seed and deleting a row resets to default.
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
