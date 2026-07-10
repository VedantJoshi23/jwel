---
id: ADR-0004
title: Rule-Based In-House Risk Scoring, Not a Fraud SaaS
version: 1.0.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M3
category: Decision
priority: Medium
depends_on: []
required_by:
  - DOM-RISK
tags:
  - risk
  - fraud
  - decision
risk: Medium
complexity: Medium
---

# ADR-0004 — Rule-Based In-House Risk Scoring, Not a Fraud SaaS

## Context

`SECURITY.md` already names fraud (payment/coupon abuse, targeting
high-value goods) as a real threat category, but nothing computes a risk
signal for any order today — `DOM-SHIPPING`'s COD gate (a static
₹25,000/first-order-only rule) is the only fraud-adjacent control that
exists, and it only covers COD, not prepaid-card fraud, account
takeover, or velocity abuse (many orders in a short window from a new
account).

## Options Considered

- **A rule-based in-house risk engine**: velocity counters (orders per
  account per time window), order-value-vs-account-age scoring, and a
  small number of named heuristics (new account + high value, many
  failed payment attempts before a success, shipping address that
  doesn't match billing/account history) — combined into a score that
  flags an order for manual review above a threshold. No third-party
  fraud vendor. Mirrors this codebase's own existing precedent: the
  Recommendation/AI domain is explicitly "rule-based co-occurrence... not
  a trained model" (`BACKEND.md` §9) by deliberate choice, not as a
  placeholder for something fancier later.
- **A fraud-scoring SaaS (Signifyd, Seon, Riskified, or similar).** Real
  capability (device fingerprinting, cross-merchant fraud signal
  sharing, chargeback guarantee products in some cases) that an in-house
  rules engine cannot match — rejected for now on cost and on the same
  "no real usage data yet" reasoning `ADR-0003` (Oriveda's own
  submodule-vs-package decision) and this project's own `ADR-0001`
  Revisit Criteria use: designing/paying for cross-merchant fraud
  intelligence before jwel has enough order volume to generate a
  meaningful fraud-loss baseline is premature spend.
- **No risk scoring at all, rely solely on `DOM-SHIPPING`'s COD gate.**
  Rejected — COD is one fraud vector among several `SECURITY.md` already
  names; leaving prepaid-fraud and velocity-abuse completely unaddressed
  once real traffic exists is a known gap, not an acceptable "not yet."

## Decision

Build a rule-based in-house scoring engine behind a `RiskScoringPort`
(same swappable-port shape as every other provider-backed domain in this
codebase) so a future SaaS integration is an adapter swap, not a rewrite.
Scoring is advisory only (see `DOM-RISK` §2) — it flags for human review,
it does not auto-cancel or auto-hold an order itself.

## Consequences

- No cross-merchant fraud signal, device fingerprinting, or chargeback
  guarantee — real capability gaps versus a fraud SaaS, accepted given
  zero current fraud-loss data to size the cost/benefit against.
- Rule thresholds (velocity window, value/account-age scoring weights)
  are starting heuristics with no historical data behind them yet — see
  `DOM-RISK`'s Open Questions; expect to tune these after real orders
  exist, not get them right on the first attempt.
- Because scoring is advisory-only, a determined fraudster whose order
  scores low still gets through — this is the accepted cost of "human
  reviews the flag queue" rather than "system auto-blocks," chosen
  because a false-positive auto-block on a legitimate high-value
  customer is its own real cost (a lost sale, a bad experience) that an
  early-stage rules engine isn't confident enough to risk yet.

## Revisit Criteria

Revisit toward a fraud SaaS once real chargeback/fraud-loss data exists
and shows the in-house rules engine's false-negative rate is a material
cost — not on a hypothetical "SaaS would probably catch more" basis with
no data behind it.
