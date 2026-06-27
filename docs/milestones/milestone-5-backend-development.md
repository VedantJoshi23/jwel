# Milestone 5 — Backend Development

## Architecture Document
No changes to `ARCHITECTURE.md`'s bounded-context map. See
[`BACKEND.md`](../../BACKEND.md) §2 for the one explicit deviation: a flatter
per-module structure than the 4-layer DDD split originally specified in
ARCHITECTURE.md §8, with the strict port/adapter pattern reserved for Payments
only (the one module with a real, business-confirmed second implementation —
Razorpay activation).

## Tasks Completed
- [x] NestJS app scaffolded at [`apps/api`](../../apps/api) — `package.json`,
      `tsconfig.json`, `nest-cli.json`, `.env.example`
- [x] All 8 required modules implemented end-to-end (controller + service + DTOs
      + Prisma access): Auth, Users, Products, Orders, Payments, Inventory,
      Reviews, Coupons — see [`BACKEND.md`](../../BACKEND.md) §1 for the endpoint
      map
- [x] Swagger: full OpenAPI doc at `/docs`, bearer-auth scheme, tags per module
- [x] Validation: global `ValidationPipe` (whitelist + forbid-non-whitelisted +
      transform), `class-validator` DTOs throughout
- [x] Error handling: single `AllExceptionsFilter` normalizing HttpExceptions
      and Prisma known-request errors into one response envelope
- [x] Logging: `LoggingInterceptor` + `CorrelationIdMiddleware` for end-to-end
      request tracing
- [x] RBAC: global `JwtAuthGuard` + `RolesGuard`, `@Public()`/`@Roles()`
      decorators, object-level ownership checks in services (not just route guards)
- [x] Race-safe inventory reservation via conditional raw `UPDATE` statements
      (no SELECT-then-UPDATE window)
- [x] Checkout orchestration with transactional stock+order+coupon writes and
      explicit compensation if payment-intent creation fails afterward
- [x] Stripe payment-provider adapter (live) + Razorpay stub adapter that fails
      loudly if invoked, both behind one `PaymentProviderPort`
- [x] Found and fixed a `passwordHash` leak in `UsersService` during this same
      pass (was returning the raw Prisma `User` row) — documented in BACKEND.md
      §3.7 rather than silently corrected

## Tasks Remaining
- [ ] Run `prisma migrate dev` against a real Postgres instance — this code has
      never been executed against a live database
- [ ] Set up Jest unit tests and Playwright e2e scaffolding (referenced in
      ARCHITECTURE.md's tech stack, not yet present in `apps/api/test`)
- [ ] Cart module / persisted server-side cart API (currently checkout accepts a
      flat items array; no cross-device cart persistence endpoint yet)
- [ ] Returns module (FR-11) — explicitly out of this milestone's scope
- [ ] Notification module (Resend) — order-confirmation emails not sent yet
- [ ] Domain event bus — current implementation calls services directly
      instead of publishing/consuming the events ARCHITECTURE.md §5 specifies;
      flagged as a real gap, worth closing once a second consumer of the same
      event exists
- [ ] Redis caching layer (DATABASE.md §4 key design is specified, not wired in)
- [ ] Elasticsearch integration (Products currently fall back to in-memory
      price sort/filter over a Postgres result set)
- [ ] Gold-rate-linked pricing / `GoldRateProvider` port — still blocked on the
      unresolved gold-rate data source (PRODUCT.md §11)
- [ ] Auth.js bridging between frontend session and backend-trusted JWT
- [ ] Wire shared DTOs through `packages/types` instead of module-local types,
      once Storefront Core starts consuming this API

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. Milestone 4 — Database Engineering ✅
6. **Milestone 5 — Backend Development ✅ (this milestone)**
7. Milestone 6 — Storefront Core + Admin Panel (consume this API; surfaces the
   Cart-persistence and Auth.js-bridging gaps directly)
8. Milestone 7 — Customer Features completion (Returns, Wishlist API,
   Notification module)
9. Milestone 8 — Advanced/AI (Recommendation, Gift Engine, Search/Elasticsearch)
10. Milestone 9 — Payments hardening (Razorpay activation decision, if ever made)
11. Milestone 10 — Observability & Hardening (Redis caching, event bus,
    Grafana/Prometheus live, test suites, OWASP/WCAG/perf audits against real code)
12. Milestone 11 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Code has never run against a real database — migration or runtime errors could surface late | Flagged explicitly as the top remaining task; first real `prisma migrate dev` run and smoke test must happen before Milestone 6 build-out begins, not deferred further |
| No automated tests exist yet for checkout/inventory/payment logic — the highest-risk code paths in the whole backend | Explicitly named as a remaining task rather than assumed-done; recommend test coverage for `OrdersService.create`/`InventoryService.reserve`/`PaymentsService.handleStripeWebhook` specifically before this code handles real traffic |
| No event bus means Payments and Orders are coupled by direct Prisma calls instead of the loosely-coupled design in ARCHITECTURE.md §5 | Documented as a deliberate, named simplification (not an oversight) in BACKEND.md §4, with a concrete trigger for when to revisit it (second consumer of the same event) |
| Cart not persisted server-side means a logged-in user's bag doesn't survive a device switch, contradicting DESIGN.md Journey C | Flagged as a gap, not implemented as a workaround — a Cart module should be added in Milestone 6 rather than bolting cart-like behavior onto Orders |
| Razorpay stub throws loudly if ever accidentally invoked | This is intentional fail-safe behavior (SECURITY.md §4) — confirmed working as designed, not a bug to fix |
