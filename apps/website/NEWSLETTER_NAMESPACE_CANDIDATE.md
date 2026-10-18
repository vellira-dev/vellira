# Newsletter budget — isolated namespace-owner candidate

Tracking: [#1728](https://github.com/vellira-dev/vellira/issues/1728).
Status: **offline candidate; no Cloudflare upload, namespace, binding or activation**.

This increment points the already-dormant budget owner Worker at the
SQLite-backed `NewsletterRollingBudgetCoordinator`. The non-default
`cloudflare/newsletter-budget-owner.wrangler.candidate.jsonc` is a **proposal
only**. No existing staging/production Wrangler file or deploy workflow
references it. Never deploy this config simply because its PR was merged.

## Single account authority

`cloudflare/newsletter-budget-namespace-plan.json` records the proposed
authority for a single Buttondown account:

- One owner Worker: `vellira-newsletter-budget-owner`.
- One live class if deployed: `NewsletterRollingBudgetCoordinator`, SQLite.
- One logical object name: `one-buttondown-account`, matching the existing
  admission adapter's `idFromName()` key.
- Both `vellira-website-staging` and `vellira-website` must eventually
  bind `NEWSLETTER_GLOBAL_BUDGET` to that **same external Worker** through
  `script_name`. No binding or enable flag has been added to either site.
- The proposed owner has `workers_dev: false`, no public routes, no provider
  key, no API calls, and **no budget capacity**. Even if someone deployed the
  owner alone, admission cannot succeed with missing capacity. Deployment
  still requires explicit approval.

Matching names in this repository do **not** prove a shared remote namespace.
Cloudflare environments, accounts, dispatch namespaces, and Worker owners can
have distinct class namespaces. Before enabling any site binding, inspect the
actual Cloudflare account, owner Worker, class export, environment, binding's
`script_name`, and the same object identity from all relevant writers.
Record only non-sensitive proof metadata privately or in an approved
sanitized attestation. Never place account tokens or subscriber data in git.

## Provider evidence — unresolved, blocking activation

Buttondown's public documentation describes a **default** of 100
`POST /v1/subscribers` requests/day and a separate 600 requests/minute
general API limit. The per-account subscriber-create ceiling can grow over
time. No verified Vellira account-specific daily allowance, accounting rule,
reset schedule, or inventory of other writers is available here.

- Obtain authoritative account-specific **subscriber-create** quota and reset
  semantics from Buttondown's account/support evidence, not a guess based on
  the documented default.
- Confirm staging and production use the same provider quota scope and
  whether another script, admin tool, import or integration writes subscribers.
- Decide conservative operational headroom and ordinary-newsletter fairness,
  then separately approve a capacity value **below** the verified limit.
- The existing local read-only subscriber audit uses GET requests and cannot
  demonstrate the POST subscriber-create limit. Do not send POST probes to
  infer it, exhaust the quota, or publish private response bodies.

The plan deliberately marks these facts `unverified`, and owner activation
`not-granted`. No code should treat this plan as deploy authority.

## Separate approval sequence

1. Merge only after exact-head CI and independent review. Keep both sites OFF.
2. Confirm Buttondown quota, account scope, other writers and reset semantics.
3. Confirm Cloudflare account ownership and operational permissions; review
   namespace lifecycle and Workers.dev/WAF coverage.
4. With explicit owner approval, run an **offline dry-run validation** of the
   standalone candidate config. It must not call Buttondown or write Cloudflare.
5. Separately approve a namespace-owner deployment, and test persistent
   storage/concurrency remotely using synthetic traffic **without** a provider
   call. The candidate cannot be treated as deployed merely because it exists.
6. Propose and review both website remote bindings and test OFF-mode behavior.
   Only after a further, explicit approval can a short staging ON test occur,
   with synthetic request handling and a verified OFF rollback.
7. Production/global budget and public Pro activation remain separate decisions.

References:

- https://docs.buttondown.com/api-rate-limits
- https://docs.buttondown.com/api-subscribers-create
- https://developers.cloudflare.com/workers/wrangler/configuration/#durable-objects
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
