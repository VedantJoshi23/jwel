---
id: ADR-0028
title: Radix Dialog Carries the Bag Drawer, Rather Than a Hand-Rolled Overlay
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-09-12
updated: 2026-09-12
milestone: M6
category: Decisions
priority: Medium
depends_on: []
required_by: []
related_documents:
  - DOM-SHOPPING
  - STD-ACCESSIBILITY
related_decisions:
  - ADR-0019
  - ADR-0025
tags:
  - decision
  - frontend
  - accessibility
  - dependency
risk: Low
complexity: Low
---

# ADR-0028 — Radix Dialog Carries the Bag Drawer, Rather Than a Hand-Rolled Overlay

## Context

Adding a piece to the bag confirmed with a toast and nothing else. The bag
itself was reachable only by going and finding the header's cart button, so
the one moment a shopper had actually decided something was the moment the
storefront asked nothing of them.

A first pass put a "View bag" action on that toast. The owner's judgement
was that it did not suffice, and it does not: a toast can confirm, but it
cannot show what is now in the bag, what it costs, or offer both onward
routes — and those are the facts that decide whether someone keeps shopping
or checks out. The replacement is the usual mini-cart: a panel sliding in
from the right, listing the bag with a subtotal, Checkout, and View bag.

That panel is a modal dialog, and this codebase had nothing to build one
from. `components/ui/` has badge, button, card, checkbox, input, select,
separator, skeleton and tabs — no dialog, sheet or popover. The header's
mobile menu looks like a drawer but is a disclosure (`aria-expanded`), not
a focus-trapped overlay, so it is not a pattern to copy. The product zoom
uses `yet-another-react-lightbox`, which brings its own and is not
general-purpose.

So the choice was: write the modal behaviour, or take a dependency for it.

## Decision

**Take `@radix-ui/react-dialog`**, and build the drawer
(`components/cart/cart-drawer.tsx`) on it.

The behaviour a modal on the purchase path has to get right is not small:
a focus trap, focus restored to the trigger on close, Escape to dismiss,
background scroll lock, inert/`aria-hidden` handling for the rest of the
page, `role="dialog"` with `aria-modal` and a labelled title, and a
portal that escapes ancestor stacking and overflow. Each is individually
easy to write and collectively easy to get subtly wrong, and the failure
mode is silent: a keyboard or screen-reader user is stranded behind an
overlay they cannot leave, on the step immediately before payment.

Three things make this a cheap dependency rather than a new direction:

- **Radix is already here.** `@radix-ui/react-checkbox`, `react-slot` and
  `react-tabs` are existing dependencies, so this is a fourth package from
  a family already vendored, not a new vendor.
- **It is unstyled.** Radix ships behaviour and leaves appearance alone, so
  the drawer is styled with this project's own tokens and `--glass-*`
  materials (`ADR-0019`) exactly as a hand-rolled panel would be. No theme
  to fight or override.
- **It is confined.** One component imports it. Removing it later means
  rewriting that file, not unpicking a pattern from across the codebase.

Opening it is a zustand store (`lib/cart-drawer-store.ts`), because the
things that open the drawer — a card's quick-add, the PDP, the wishlist —
are scattered, and the drawer is mounted once in `SiteChrome` nowhere near
any of them. Threading a callback down every one of those paths is the same
coupling with more steps. The store is deliberately not persisted, unlike
`auth-store`: a drawer that reopened itself on the next page load would be
re-announcing a decision the shopper had moved on from.

## Consequences

**Positive**

- The accessibility obligations above are met by a widely-used, tested
  implementation rather than by our own first attempt at a focus trap.
  Verified against the running page: focus lands inside the drawer, the body
  scroll locks, Escape closes it, and axe reports zero violations.
- Adding a piece now shows the bag, its subtotal and both routes onward,
  which is what was actually asked for.
- The toast is gone rather than kept alongside — two confirmations of one
  event is one too many.

**Negative**

- **A runtime dependency on the purchase path**, which is the same bar
  `ADR-0025` was written to, and it carries the same exposure: a bug or a
  breaking change in Radix Dialog now reaches checkout. Mitigated only by
  its confinement to one file.
- Bundle cost, unmeasured. No bundle budget exists yet (STD-PERFORMANCE
  records that gap as KC-172), so this is stated as a known unknown rather
  than dressed up with a number that was not measured.
- The drawer moves focus on every add. That is correct for a
  user-initiated modal, but it is a bigger interruption than a toast, and
  if it ever proves unwelcome the fix is a design change, not a setting.

## Alternatives Considered

- **Hand-roll the overlay** — rejected. Not for effort but for risk: the
  list above is long, the failure mode is silent, and it sits one step from
  payment. Nothing in the codebase existed to copy, so this would have been
  a first implementation, not a reuse.
- **Keep the toast, add a second action** — rejected by the owner, and
  rightly: "View bag" and "Checkout" side by side in a toast still shows
  neither the contents nor the total, which is the actual gap.
- **Navigate to `/cart` on add** — rejected. It answers the question by
  removing it, and it ends the shopping session for anyone who wanted to
  keep browsing. The drawer leaves closing as a free third answer.
- **A different headless library (Headless UI, Ark, React Aria)** — no
  reason to introduce a second component vendor when the one already in use
  covers this.

## Revisit Criteria

- **If a second modal surface appears** (a size guide, a quick-view, a
  confirm dialog), promote the drawer's shell into
  `components/ui/dialog.tsx` rather than importing Radix directly a second
  time — the confinement argument above only holds while there is one call
  site.
- **When a bundle budget exists** (KC-172), measure this package's actual
  cost and record it against the Negative note above, which today is
  honest about being unmeasured.
- **If Radix Dialog is ever the blocker on a React upgrade**, the
  confinement is the exit: one file to rewrite.

## Cross References

- `ADR-0019` — the glass material language the drawer is styled in.
- `ADR-0025` — the precedent for recording a new runtime dependency on the
  checkout path.
- `DOM-SHOPPING` — the bag's invariants; the drawer reads lines and their
  price snapshots through `useCart` and asserts nothing of its own.
- `STD-ACCESSIBILITY` — the rules the modal behaviour above exists to meet.
