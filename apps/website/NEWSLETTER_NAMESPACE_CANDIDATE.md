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

### Evidence needed from Buttondown (no subscriber writes)

The authenticated **GET** rate-limit headers (`X-RateLimit-Limit`,
`X-RateLimit-Remaining`, `X-RateLimit-Reset`) may describe the
**600/minute general API limit**, not the **daily POST subscriber-create
quota**. A successful GET, its reset timestamp, and a 600 limit are
**not proof** of the newsletter's available daily create capacity.

Ask Buttondown support (support@buttondown.email) or inspect an
authoritative account-specific quota setting for:

1. The exact `POST /v1/subscribers` ceiling for this newsletter/account,
   whether it applies across API keys and environments, and how it changes.
2. The exact window and reset semantics, including timezone, and whether
   duplicate/suppressed/blocked/failed requests or ambiguous timeouts count.
3. Whether any other integrations or UI operations consume the same quota,
   and whether a **read-only** account-specific quota report is available.
4. A safe reserved-capacity recommendation for an existing public newsletter.

Record **only sanitized evidence**: source, observation date, the
account-level conclusion, any verified numerical ceiling/window, and
an owner-approved reserve. Never store tokens, complete response headers,
subscriber emails, account IDs or provider payloads in the repository.
Until the evidence is conclusive, leave the global mode OFF.

### Local read-only usage audit (no subscription writes)

The script `scripts/buttondown-api-requests-readonly.mjs` accesses only
Buttondown's documented `GET /v1/api_requests` listing endpoint and
requests the preceding **seven days** with server-side filters for
`method=POST` and `path=/v1/subscribers`. This is a diagnostic for
**API-request activity**, not an account-specific daily quota endpoint.

Run it only from a trusted local checkout with your **existing** API key
already available in the local environment:

```sh
node --env-file=apps/website/.dev.vars apps/website/scripts/buttondown-api-requests-readonly.mjs
```

Or, when `BUTTONDOWN_API_KEY` is already in the process environment:

```sh
node apps/website/scripts/buttondown-api-requests-readonly.mjs
```

The script sends only GET requests, at most five pages of 100 records each.
It generates each fixed API URL independently rather than following
provider-supplied pagination URLs, rejects ignored filters, missing pages,
inconsistent totals and corrupted results, and stops with no partial report
when the result set exceeds the bounded maximum. The API key is not logged,
stored, transmitted to GitHub or included in its output. Raw API-request
objects (including IPs, API-key IDs/labels and request identifiers) are held
in memory only; output includes **aggregate status categories, source
categories and UTC-day counts**, never credential-diversity metrics. These
diagnostics contain no subscriber records or request payloads.

A successful audit does **not** prove that Buttondown retained every
historical request, that all subscriber creation occurs through this API,
or that an observed API key/source corresponds to exactly one writer.
Even **zero** matching rows is not authoritative proof of zero attempts.
If the API does not expose request history to the existing key, do not
grant broader permissions automatically or retry using subscriber writes.
A failing or incomplete audit must not inform a production capacity decision.

Test without network or provider credentials:

```sh
node --test apps/website/scripts/buttondown-api-requests-readonly.test.mjs
```

References:

- https://docs.buttondown.com/api-api-requests-list
- https://docs.buttondown.com/api-pagination
- https://docs.buttondown.com/api-rate-limits

### Offline Wrangler preflight

After installing the existing lockfile dependencies, run:

```sh
node --test apps/website/scripts/newsletter-owner-wrangler-dry-run.test.mjs
```

This invokes the repository-pinned Wrangler with fixed `deploy --dry-run`
and a temporary bundle output. The test provides **no Cloudflare or Buttondown
credentials**, disables Wrangler telemetry, blocks outbound proxy access, and
asserts the compiled bundle exports the expected class without provider
credentials. It is also part of mandatory `test:cloudflare-cache` CI.

A successful dry-run proves local Wrangler compilation **only**. It
does not authenticate to Cloudflare, provision namespaces, establish
cross-Worker bindings, verify any account-scoped namespace identity, or
authorize a real deployment.

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
