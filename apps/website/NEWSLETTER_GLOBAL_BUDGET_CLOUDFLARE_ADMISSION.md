# Newsletter global budget — Cloudflare deployment admission

Status: **design and admission gate only**. Parent issues: #1728 and #1712.
No Cloudflare Durable Object namespace, production binding, or provider quota enforcement is activated by this document.

## Current state (18 October 2026)

The website handler calls the optional global admission adapter before the
Buttondown subscriber-create request. The adapter returns no callback when
`NEWSLETTER_GLOBAL_BUDGET_ENABLED` is absent or `0`. The coordinator and
local Miniflare persistence tests exist, but the deployed Cloudflare website
does not export the coordinator class, and neither canonical Wrangler target
declares a global-budget Durable Object binding.

The coordinator currently stores one monotonically increasing `spent` value
**without any window or reset**. It is not yet a daily quota implementation.
Do not turn it ON merely because the current adapter fails closed on a missing
binding: a real ON rollout requires verified quota and reset semantics.

## Single authoritative namespace

For one Buttondown account, there must be exactly one authoritative namespace
and object ID for all Vellira callers that can send subscriber-create requests.

- Prefer a separately owned, explicitly named budget Worker with a
  SQLite-backed Durable Object class; staging and production website Workers
  should bind to **that same owner** through `script_name` rather than each
  registering an independent class. This is a proposal, not authorization to
  deploy another Worker.
- Inventory the actual Buttondown credential/account used by each environment,
  other subscriber-create writers, and whether sharing is acceptable before
  selecting that authority. Separate keys may still share an account quota.
- The coordinator's object-name key must be stable across all callers; a
  constant on two **distinct namespaces** does not provide a shared budget.
- Do not declare `NewsletterBudgetCoordinator` separately in both staging
  and production website configurations. The ownership decision needs
  migration/rename/rollback review, cost assessment, and access controls.
- New Durable Object namespaces require the SQLite backend. Cloudflare
  supports declaring classes using `exports` (preferred for new projects)
  or legacy `migrations`; do not combine those lifecycle mechanisms.

## Provider proof required before runtime wiring

Record evidence from the actual Buttondown plan/account for:

1. Subscriber-create quota units, window and reset boundary; whether failed,
   duplicate, or timed-out requests count. Do not assume 100/day or midnight UTC.
2. Other writers and environment keys; reserve enough quota for existing
   engineering newsletter delivery.
3. The actual number and meaning of budget admissions, including unknown
   outcomes and conservative non-refund rules.
4. A fair strategy for distributed abuse: a single global counter protects the
   upstream limit but malicious callers can otherwise exhaust it and starve
   ordinary subscribers.

If any fact is unknown, leave the global budget OFF.

## Deployment sequence — separate approvals

1. Confirm Cloudflare account-side WAF and Workers.dev/custom-domain coverage,
   traffic observability, production site deploy gates and Worker ownership.
2. Review a **standalone** infrastructure PR for the namespace owner and any
   SQLite class declaration. Keep site Worker config unchanged until authority
   is established. Ensure no subscriber write can happen from the new owner.
3. Verify actual cloud persistence/concurrency and namespace identity with
   safe synthetic traffic, while all site admission modes remain OFF.
4. Review separate default-OFF website binding PRs referencing that owner.
   Fail closed on ON/missing binding; normal OFF requests must remain unchanged.
5. Only with separate owner approval and provider quota/window validation,
   review window/reset implementation and conduct a short staging-only ON
   no-write test followed by mandatory OFF restoration. Production Pro and
   global-budget mode remain OFF until a distinct rollout decision.

## Hard acceptance checks

- Exact-head CI GREEN and no unreviewed secret values or provider writes.
- A test must fail if staging and production declare distinct local DO owner
  classes while using a shared Buttondown account.
- Synthetic concurrent callers share the same storage identity and cannot
  admit more than the configured maximum.
- Missing/invalid bindings and coordinator failures deny before Buttondown.
- The OFF path preserves the engineering newsletter and does not charge a
  budget slot.
- Rollback instructions cover a failed deployment *after* activation as well
  as a successful preview; OFF restoration must be independently confirmed.

References:

- https://developers.cloudflare.com/workers/wrangler/configuration/#durable-objects
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://github.com/vellira-dev/vellira/issues/1728
