# Milestone 14 — Hybrid Admin

Implements `ADR-0006`. In progress.

## Architecture Document

No architectural change beyond what `ADR-0006` already describes, with one
correction made *to* the ADR during this milestone: its Decision section
proposed moving categories/coupons/banners CRUD to AdminJS, but its own
Context section already listed those as existing custom-admin pages — a
contradiction that had gone unnoticed since the ADR was written. Corrected in
the ADR itself (see that doc's Decision/Consequences sections for the
full explanation) rather than silently building on the wrong premise.

## Tasks Completed

- [x] **Admin Returns UI** (PR #20) — the gap found during M12's live refund
      validation: `ReturnsService`'s backend was complete but nothing in
      `apps/web` called it. New page mirrors the existing admin-page pattern
      (`admin-guard.tsx`, Card/Badge/Button primitives, `ApiError` handling).
  - **Two real bugs found via real-browser testing, not unit tests**: (1) a
    pre-existing hydration race in `AdminGuard` — a hard navigation to any
    `/admin/*` URL could redirect an already-logged-in admin to `/login`
    before `zustand/persist` finished rehydrating from localStorage; (2) the
    refund-amount input displayed a pre-filled default via a `??` fallback
    that the underlying state never actually held until `onChange` fired —
    an admin who trusted the pre-fill and clicked straight through submitted
    nothing. Both fixed; regression tests added for both, verified to fail
    against the pre-fix code.
- [x] **Admin audit log** (PR #21) — new `AuditLog` module + Prisma table.
      Covers the custom-admin workflow surface per ADR-0006's criterion:
      order status transitions, return approvals/refunds (real Razorpay
      money movement), inventory adjustments, user suspension. Each entry
      records the acting admin (`actorId`/`actorEmail`), action, entity, and
      a small metadata snapshot. `GET /admin/audit-log` (admin-only) lists/
      filters by entity or actor.
  - **A second real bug found while integration-testing this**: the admin
    Returns page's status filter (shipped live in PR #20) 400s on any value.
    Root cause: the global `ValidationPipe`'s `forbidNonWhitelisted` rejects
    any query property not declared on the single DTO bound to `@Query()` —
    `@Query() query: PaginationQueryDto` alongside a second
    `@Query('status')` parameter doesn't survive that; NestJS hands the
    *entire* raw query string to the DTO-bound parameter. Fixed by folding
    the extra filter into one DTO class (`AdminFindReturnsQueryDto`), same
    fix applied to the new audit-log endpoint which had the identical bug.
    Caught only because integration tests hit a real `ValidationPipe`; the
    unit tests (mocked service, no pipe in the request path) could not have
    caught it, and didn't.
  - **A third issue, found via what looked like an indefinite hang**: the
    integration suite appeared to hang for nearly two hours on a second run.
    Actual cause: `AuditLog.actorId` is a deliberate `RESTRICT` foreign key
    onto `User` (an audit trail should outlive the actor it records — app
    code only ever soft-deletes admins via `deletedAt`, never a hard
    delete). The shared test-cleanup helper (`cleanupTestUser`) does a hard
    `prisma.user.deleteMany()`, which now fails with a foreign-key violation
    for any admin who performed an audited action during the test. Isolated
    by bisecting per-spec-file runs rather than assuming the earlier
    open-ended timeout meant a genuine deadlock. Fixed the shared helper to
    delete owned audit-log rows first; the FK itself was correct as
    designed and was not changed.
- [x] **AdminJS evaluated and rejected.** Installed for real (not just read
      about) to check the actual dependency cost: ~400 packages into
      `apps/api` — the same process that handles Razorpay payments — with 62
      `npm audit` findings (1 critical, 14 high) in its bundling toolchain.
      The resolved versions of packages this app's own code imports
      (multer, bcrypt, `@nestjs/platform-express`) were unaffected — the
      findings are in AdminJS's own tooling deps — but the footprint was
      judged not worth it for a payment-processing service. Fully reverted
      (`package.json`/`package-lock.json` confirmed matching `main` exactly,
      `node_modules` reinstalled clean) before this was written up.
  - react-admin and Refine were evaluated as lower-risk alternatives (2-3
    high findings, 0 critical, both run entirely in `apps/web` with zero
    backend footprint) and react-admin was the preferred pick between them —
    but separately, a roadmap search found **no concrete unbuilt CRUD-shaped
    admin resource to point any framework at** (every named gap — Risk
    queue, Shipment/NDR queue — is workflow-shaped, not CRUD, by ADR-0006's
    own criterion). Building react-admin infrastructure against no real
    target would have been speculative work. Deferred; see `ADR-0006`'s
    updated Decision section.
- [x] **Discovered categories/coupons/banners CRUD already exists.** All
      three are complete, hand-built `apps/web` pages
      (`app/(admin)/admin/{categories,coupons,cms}/page.tsx`), live in
      production, wired into the admin nav — coupons/banners since the
      initial MVP commit, categories added in a later commit
      (`a7a6237`). ADR-0006 described these as an AdminJS gap; they were
      never actually missing. `ADR-0006`, `README.md`, and this document are
      the fix — no code change was needed or made.

- [x] **Metabase for business reporting** (per `ADR-0006`'s hard
      requirement of a dedicated read-only database user). Own isolated
      Compose project (`jwel-metabase`), pinned `metabase/metabase:v0.63.1`,
      its own Postgres database on the existing `jwel-data` instance for its
      application state (dashboards/questions/users) — deliberately not the
      default embedded H2 store, which Metabase's own docs call unsafe for
      production.
  - **The read-only requirement was proven, not assumed**: after granting
    `metabase_ro` only `SELECT`, a real `UPDATE`/`INSERT` attempt against it
    was run and confirmed rejected (`permission denied for table orders`)
    before recording this as done.
  - **A real mistake, caught by actually booting the container**: the first
    draft of `docker-compose.metabase.yml` referenced `${MB_DB_USER}`/
    `${MB_DB_PASS}` inside the `environment:` block — Compose *substitution*
    syntax, which only reads the root `.env`, never `.env.production`. Since
    `env_file:` already injects those exact names from `.env.production`,
    the `environment:` block's unset `${VAR}` silently overwrote them with
    an empty string. This is the identical failure mode the Grafana build
    hit and documented a warning against in M13 — and it was made again
    here anyway, despite writing that exact warning into this file's own
    header comment first. Fixed; comment updated to explain the mechanism,
    not just repeat the warning.
  - Postgres 15+'s no-default-CREATE-on-public-schema change meant the
    `metabase` role's database-level `ALL PRIVILEGES` grant alone wasn't
    enough for Metabase's own migrations to create its tables on first
    boot — needed an explicit `GRANT ALL ON SCHEMA public` inside the
    `metabase` database itself. Caught the same way: by actually letting
    the container try to migrate, not by assuming the earlier grant covered
    it.
  - End-to-end verified with a real query, not just a successful connection
    test: `SELECT status, count(*) FROM orders GROUP BY status` executed
    through Metabase's own query engine against the `metabase_ro` connection
    returned real production order data.
  - `backup.sh` extended to also dump the `metabase` application database
    (unlike Grafana's, this is real state with no provision-as-code
    equivalent — someone will build dashboards by hand) — conditional on the
    database existing, so a deployment that never opts into Metabase doesn't
    start failing its nightly backup over a database it was never asked to
    create. Run once by hand and confirmed non-empty.
  - **Public subdomain live**: `metabase.whisperingorion.dev`, cert issued,
    own nginx vhost installed, `nginx -t` passed, storefront/API/Grafana all
    confirmed unaffected after reload. Verified with a real HTTPS request
    over the actual network path (`--resolve`-pinned curl, `200`) rather
    than trusting `nginx -t` alone — the VM's own local resolver
    (`systemd-resolved`, Oracle Cloud's internal upstream) lagged behind the
    public record for a while after the client added it, which made a plain
    `curl https://metabase.whisperingorion.dev/` from the VM itself
    misleadingly fail with a DNS error even though public resolvers
    (8.8.8.8, 1.1.1.1) and real external clients already resolved it
    correctly — a self-lookup artifact, not a deployment problem, confirmed
    by checking against public resolvers rather than assuming the VM's own
    failure meant something was actually wrong.

## Tasks Remaining

- [ ] Directus-vs-Payload spike for the CMS module (banners, homepage
      content) — also closes FR-23's unbuilt scope (category landing
      content, lookbook/editorial).
- [ ] A CRUD framework for future admin entities remains deliberately
      undecided — revisit only when a concrete new entity is named in a
      roadmap doc (see `ADR-0006` Revisit Criteria).

## Updated Roadmap

1. Milestones 0–13 — MVP, testing, CI, Razorpay, observability ✅
2. **Milestone 14 — Hybrid admin (this milestone).** Returns UI ✅, audit log
   ✅, categories/coupons/banners confirmed already built, AdminJS evaluated
   and rejected, Metabase built and live at `metabase.whisperingorion.dev`.
   Remaining: CMS spike.
3. Milestone 15 — Deployment / go-live.
4. Milestone 16+ — Shipping, WhatsApp/SMS, Fraud/Risk.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A second admin-tool's mutations could go unaudited if adopted carelessly | Documented explicitly in `ADR-0006`: whatever CRUD framework is eventually chosen must get its own hook into the existing `AuditLog` table/service as part of adoption, not as a follow-up |
| Docs drifting from reality again, the way ADR-0006's CRUD section did | The specific failure mode here was a *contradiction within a single document* (Context said X existed, Decision said to build X) going unreviewed. Worth a habit, not just a one-time fix: when editing an ADR's Decision, re-read its own Context section for claims that already answer the question |
| AdminJS's dependency footprint was discovered only by actually installing it | Same lesson as this project's "verify against the real thing" pattern elsewhere (real `next build`, real Playwright runs, real Postgres for integration tests) — `npm view <pkg> peerDependencies` proved compatibility but said nothing about transitive vulnerability count; only a real `npm install` + `npm audit` surfaced the actual cost |
| A BI tool with write access to production data is a data-loss incident waiting for a bad query (`ADR-0006`'s own framing) | Not trusted on the strength of a `GRANT SELECT`-only statement — a real `UPDATE` against `metabase_ro` was run and confirmed rejected before this milestone recorded Metabase as done |
| The exact `${VAR}`-in-`environment:`-vs-`env_file` Compose-substitution mistake that hit Grafana in M13 was made again while building Metabase's compose file, despite a warning comment already existing in this repo for it | Caught the same way as before — by actually booting the container and reading its real env, not by trusting the comment. Worth treating as a standing risk for any *future* `env_file`-backed service in this deployment, not a one-off: the warning comment alone did not prevent a repeat |
