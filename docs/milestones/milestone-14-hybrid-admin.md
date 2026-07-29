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

## Tasks Remaining

- [ ] Metabase for business reporting, against a dedicated read-only
      database user (per `ADR-0006`).
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
   and rejected. Remaining: Metabase, CMS spike.
3. Milestone 15 — Deployment / go-live.
4. Milestone 16+ — Shipping, WhatsApp/SMS, Fraud/Risk.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A second admin-tool's mutations could go unaudited if adopted carelessly | Documented explicitly in `ADR-0006`: whatever CRUD framework is eventually chosen must get its own hook into the existing `AuditLog` table/service as part of adoption, not as a follow-up |
| Docs drifting from reality again, the way ADR-0006's CRUD section did | The specific failure mode here was a *contradiction within a single document* (Context said X existed, Decision said to build X) going unreviewed. Worth a habit, not just a one-time fix: when editing an ADR's Decision, re-read its own Context section for claims that already answer the question |
| AdminJS's dependency footprint was discovered only by actually installing it | Same lesson as this project's "verify against the real thing" pattern elsewhere (real `next build`, real Playwright runs, real Postgres for integration tests) — `npm view <pkg> peerDependencies` proved compatibility but said nothing about transitive vulnerability count; only a real `npm install` + `npm audit` surfaced the actual cost |
