# Newsletter budget — isolated namespace-owner candidate

Tracking: [#1728](https://github.com/vellira-dev/vellira/issues/1728).
Status: **private owner deployed; staging OFF binding proposed, not yet deployed;
production unbound; global admission OFF**.

The isolated SQLite owner `vellira-newsletter-budget-owner` was deployed
once with explicit protected approval on 2026-10-21:
[Provision run #39608321816](https://github.com/vellira-dev/vellira/actions/runs/39608321816).
A GET-only postflight observed the private Worker with `workers.dev` and
Preview URLs disabled. Exact remote namespace identity is **not yet proven**.

This change proposes an **external binding on staging only**, in
`wrangler.jsonc`, with `NEWSLETTER_GLOBAL_BUDGET_ENABLED: "0"`. The
production config is unchanged. Merely creating a Draft PR does not deploy
staging; an authorized merge of website files may trigger the standard
staging workflow and protected production promotion. Do not rerun the
one-time private-owner provisioning workflow.

## Single account authority

`cloudflare/newsletter-budget-namespace-plan.json` records the proposed
authority for a single Buttondown account:

- One owner Worker: `vellira-newsletter-budget-owner`.
- One exported SQLite class: `NewsletterRollingBudgetCoordinator`.
  The deployed Worker is observed, but its namespace identity is unverified.
- One logical object name: `one-buttondown-account`, matching the existing
  admission adapter's `idFromName()` key.
- Staging proposes exactly one `NEWSLETTER_GLOBAL_BUDGET` binding to the
  **existing external owner** via `script_name`, with mode fixed at `0`.
  Production remains unbound. Correct names alone do not prove identity.
- The deployed owner has `workers_dev: false` and
  `preview_urls: false`, no public routes, no Buttondown key, no API
  calls, and **no budget capacity**. The staging binding does not spend
  permits while the trusted mode remains OFF.

Matching names in this repository do **not** prove a shared remote namespace.
Cloudflare environments, accounts, dispatch namespaces, and Worker owners can
have distinct class namespaces. Before enabling any site binding, inspect the
actual Cloudflare account, owner Worker, class export, environment, binding's
`script_name`, and the same object identity from all relevant writers.
Record only non-sensitive proof metadata privately or in an approved
sanitized attestation. Never place account tokens or subscriber data in git.

### Offline cross-Worker authority proof (provider-independent)

The maintained `newsletter-rolling-miniflare.test.mjs` suite now simulates
both `vellira-website-staging` and `vellira-website` as **independent,
local-only** Workers bound to one separately named owner Worker. The owner
runs the real candidate SQLite `NewsletterRollingBudgetCoordinator`, with
each caller using the identical `one-buttondown-account` Durable Object name.

The integration asserts that 30 simultaneous admissions spread across both
callers yield **exactly seven** admissions for an artificial capacity of seven,
rather than two independently spendable pools, even if each request uses a
different untrusted account/query hint and budget-key header. A separate
production-first test proves that production can consume the sole permit
before staging is denied. Both callers observe exhaustion, and exhausted
state survives full Miniflare disposal and restart. A direct request
to the owner Worker's public entrypoint remains 404; only its internal
Durable Object binding processes admissions. Spoofed caller headers cannot
choose a different budget namespace in this test harness.

Run with `node --test apps/website/scripts/newsletter-rolling-miniflare.test.mjs`;
this suite is already included in the canonical `test:cloudflare-cache` CI recipe.

**Scope:** These are synthetic local test Workers, not the production
Next/OpenNext route, not a live Cloudflare namespace, and not evidence that
another external subscriber writer has been inventoried. Actual Cloudflare
account/class/binding identity and Buttondown's numerical quota/window
remain unverified. Only the private owner has been deployed. The proposed
staging binding requires a separately approved rollout, and global admission
and public Pro remain OFF.

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

If Buttondown rejects a read-only request, the CLI reports a **fixed HTTP
status category** without returning any provider response body or headers:
`400` (filters or request rejected), `401` (authentication rejected),
`403` (access denied; may be the current key's permissions), `404`
(endpoint unavailable), `429` (rate limited), or `5xx` (provider
unavailable). These categories are diagnostic clues, not a license to
escalate key permissions or assume the provider's daily POST quota.
Never paste the contents of the local `.dev.vars` file into a conversation.

Test without network or provider credentials:

```sh
node --test apps/website/scripts/buttondown-api-requests-readonly.test.mjs
```

References:

- https://docs.buttondown.com/api-api-requests-list
- https://docs.buttondown.com/api-pagination
- https://docs.buttondown.com/api-rate-limits

### Dashboard CSV fallback when the API returns 403

Buttondown's API authentication documentation defines HTTP 403 as
**insufficient permissions** for the supplied API key. Do not change,
regenerate or broaden the existing production key simply to inspect logs.

Use the authenticated Buttondown dashboard at
https://buttondown.com/requests and select **Export** in the API Requests tab.
The downloaded CSV can contain request IDs and IP addresses: retain it on
your trusted device and **do not upload raw data** to GitHub, chat or public
analysis services. The documented CSV export schema includes
\`id,path,ip_address,creation_date,status_code,latency\`, but does **not**
guarantee a \`method\` column.

For an entirely **offline** summary, run from the repository root (replace
the placeholder path with the real CSV downloaded from your account):

\`\`\`sh
node apps/website/scripts/buttondown-api-requests-csv-readonly.mjs "$HOME/Downloads/buttondown-api-requests.csv"
\`\`\`

This command only reads a local regular file (up to 8 MiB and 50,000 records).
It never contacts Buttondown or Cloudflare. It counts exact
\`/v1/subscribers\` path entries in the last seven days, grouped by UTC day
and HTTP status; raw IPs, request IDs, email addresses and CSV contents are
not emitted. When the export contains a \`method\` column, only POST rows
are counted. **When the column is absent, GET subscriber-list operations
cannot be distinguished from subscriber-create POST attempts.** The output
labels the method as unverified rather than presenting the counts as
subscriber creates. Even a zero count never proves zero real attempts or
provider quota.

The original API audit and any live newsletter/Pro settings remain unchanged
and OFF. This fallback does not verify the account's actual daily creation
limit, reset schedule, API key coverage or other writers.

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

## Cloudflare account read-only inventory

The separate private owner Worker is already deployed (approved provisioning
run #39608321816), but the Worker presence or website binding **does not**
establish namespace uniqueness, owner/class metadata, storage persistence or
a shared Durable Object instance. The current read-only audit only counts
namespaces by class when it can demonstrate a complete list.

After merge, run this manual GitHub Actions workflow on `main`:

**Cloudflare Newsletter Account Read-Only Audit**.

The job uses the existing Cloudflare secrets for GET-only API calls.
It never creates objects, changes routing, or deploys Workers.
No Buttondown requests or subscriber writes are performed.

The sanitized report checks:

- Expected Worker names and Durable Object class namespaces.
- Workers.dev exposure and serving-version binding names.
- Custom domains, zone routes, and basic WAF rule counts.

The serving-version budget binding is reported as present only if **every**
traffic-serving version in a valid 100% deployment split contains
`NEWSLETTER_GLOBAL_BUDGET`. Mixed binding states report `false`; an invalid
or uninspectable traffic split reports `incomplete`. Binding-name presence
never proves that global budget enforcement is active.

Worker route existence checks match the Vellira zone hostname, including
documented leading wildcards, rather than incidental text in unrelated domains
or paths. A route-name match does not prove effective traffic or WAF coverage.

No token, account ID, namespace ID, raw rule, or API body is printed.

Missing permissions remain `unverified`, never interpreted as absence.
Truncated API pages and unsupported response shapes remain `incomplete`.

### Read-only inventory diagnostics (Evidence V2)

The real owner-run account audit on 2026-10-19 showed `namespaceInventoryStatus: incomplete`, `domainInventoryStatus: incomplete`, and four zone/account WAF
`permission_denied` responses. The missing budget-owner Worker and absent
site serving-version budget bindings were separately **observed**. Do not
mistake the job's `SUCCESS` for infrastructure readiness.

A following audit keeps the same GET calls and includes two fixed-literal,
allowlisted fields: `namespaceInventoryDiagnostic` and
`domainInventoryDiagnostic`. `null` means no extra diagnostic; it is **not**
proof of completeness. Incomplete status can carry one of these codes:

- `pagination_metadata_missing`: no provable `total_pages` in a
  single-page inventory that has no safe terminal proof (for example, the
  independent Worker domain inventory). Short pages alone are not proof.
- `pagination_mode_changed`: namespace pages switched between an explicit
  total-pages response and the no-metadata terminal-page convention.
- `pagination_sparse_page`: a second nonempty namespace page followed a
  short page when no total-pages metadata was available.
- `namespace_id_duplicate`: the same namespace identifier appeared more
  than once, potentially because an API ignored `page`.
- `namespace_id_uninspectable`: multiple nonempty pages cannot be
  safely de-duplicated because namespace identifiers are missing.
- `pagination_metadata_invalid`: page or count metadata is inconsistent.
- `pagination_page_limit`: more pages than the bounded audit can inspect.
- `records_uninspectable`: unexpected list shape or record type.
- `namespace_class_uninspectable`: at least one Durable Object namespace has
  no usable class; zero cannot be inferred.
- `response_uninspectable`: an HTTP 200 response cannot be safely parsed
  or validated.

The diagnostic codes disclose neither page counts nor namespace/class names,
IDs, domain inventory, provider messages, raw responses or token values.
For HTTP 403, the existing `permission_denied` status already carries the
diagnosis. Do **not** change the production Cloudflare token, assume WAF is
absent, or infer a zero Durable Object coordinator count from incomplete data.

#### Bounded namespace pagination with optional API metadata (Evidence V3)

Cloudflare's [namespace list API](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/methods/list/)
documents `result_info` as **optional**. The original audit required
`result_info.total_pages` before declaring completion, which prevented
further inspection after otherwise valid 200 responses without metadata.

The revised **GET-only** audit still accepts explicit, consistent
`total_pages`, and additionally permits a metadata-less inventory only
when an **extra** page requested with `page=N&per_page=100` is explicitly
empty. A short nonempty page is never sufficient. Each page must pass
shape/metadata checks; page-mode changes, repeated IDs, ambiguous IDs
across multiple nonempty pages, sparse pages and incomplete/failed follow-up
reads remain `incomplete` or `permission_denied`, **not** zero. The request
budget is bounded to three namespace pages. No namespace IDs, raw response
bodies or account IDs are logged. A verified single class namespace count
does **not** independently establish the same remote instance used by
every environment.

[Account audit #39673225554](https://github.com/vellira-dev/vellira/actions/runs/39673225554)
on 2026-10-21 reported `namespaceInventoryStatus: incomplete` because
`pagination_metadata_missing`, while confirming the named staging binding
in all traffic-serving versions, production binding absent, private owner
URLs disabled, `remoteWrites: 0` and `providerWrites: 0`.
Re-run this audit **only after** the diagnostic PR is reviewed/merged and
the mandatory CI is GREEN; do not edit production Wrangler or the owner.

For WAF inspection, current zone/account entrypoint GETs return
`permission_denied`. Cloudflare documents read-only permissions
[`Zone WAF Read`](https://developers.cloudflare.com/waf/custom-rules/custom-rulesets/)
and [`Account WAF Read` / `Account Rulesets Read`](https://developers.cloudflare.com/ruleset-engine/basic-operations/view-rulesets/)
for inspecting relevant rulesets. The preferred next step is a **manual
Cloudflare dashboard inspection** of the `vellira.dev` zone and any
account-level WAF controls, not broadening the CI/deployment token.
If API evidence later becomes necessary, use a separately approved,
minimally scoped **read-only** credential and continue to report effective
coverage as `unverified` until route/path and bypass behavior are proven.
Do not enable the currently disabled burst-guard rule without separate
owner approval.

### Proposed Preview URL exposure reduction (review-only)

Owner screenshots on 2026-10-19 confirmed that `workers.dev` and wildcard
Preview URLs for both site Workers were available without Access sign-in.
The Cloudflare Free zone rule `vellira-newsletter-burst-guard` was saved
**Disabled**; it does not protect either `workers.dev` origin.

**Separate deployment dependencies:** Vellira's staging deployment,
production preflight, archive recovery, promotion and smoke checks use
the stable `vellira-website-staging.vellira.workers.dev` and
`vellira-website.vellira.workers.dev` origins. The maintained CI/workflow
source does not reference version-prefixed or aliased Preview URLs. This does
**not** prove that nobody uses old Preview links outside this repository.

A proposed version-controlled mitigation keeps `workers_dev: true` and
sets `preview_urls: false` explicitly in **both** canonical Wrangler configs.
This disables Cloudflare Version URLs and `workers.dev` Preview URLs after
each affected Worker is redeployed, while retaining the stable diagnostic
origins needed by existing CI. Wrangler does not alter the Preview URL setting
if `preview_urls` is omitted; an explicit false prevents subsequent config
drift. The canonical deployment-target validator rejects unintended `true`
or omitted values. This is **not** a claim that separate Cloudflare Previews
or other routing mechanisms have been audited.

**MERGE/ROLLOUT HOLD:** A config proposal passing PR CI is not a live
deployment. Do **not** merge or deploy this change until the owner separately
approves losing existing version/alias Preview URLs and confirms that no
external workflows, release recovery runbooks, collaborators or bookmarked
links depend on them. A website-file merge can trigger normal staging
deployment automatically; production may deploy after separate admission.
Both worker changes must therefore be scheduled and independently verified.

After an authorized rollout, run the existing **Cloudflare Newsletter
Account Read-Only Audit** on `main` and require both Workers to report
`workerDev.status: observed`, `enabled: true`, and
`previewsEnabled: false`. A staging-only green observation does not
prove production exposure is removed. Inspect the Cloudflare Dashboard's
Domains view as independent evidence. If any stable diagnostic URL stops
working, halt rollout; do not blindly flip the dashboard toggle. Recovery
requires a separately reviewed explicit `preview_urls: true` proposal and
an authorized redeploy—not removal of the false field.

No Worker-wide Access is enabled, no WAF rule activated, no tokens or
namespace bindings changed, and no provider request is authorized by this
proposal. The zone WAF rule does not protect `workers.dev`; global Buttondown
admission and public Pro remain OFF.

### Independent account-side evidence still required

In the Cloudflare dashboard, view zone `vellira.dev` security settings and
inspect **WAF custom rules** and **rate-limiting rules**. If the account uses
account-level rulesets, inspect those separately. Review effective scope,
applicability and bypasses, rather than assuming that a rule count proves
coverage. The existing CI deployment token's HTTP 403 is insufficient evidence.
If additional API evidence is needed, use a separately approved, minimally
scoped **read-only** authorization instead of granting WAF write or rotating
production credentials.

For both `vellira-website-staging` and `vellira-website`, open Workers &
Pages, select the Worker and inspect its **Domains** (or Settings > Domains &
Routes) options for `workers.dev` and **Preview URLs**. Their presence was
observed in the first audit. Verify any Cloudflare Access restrictions
independently; ordinary zone WAF coverage does not prove protection of
`workers.dev` or Preview URL entry points. Do not disable routes or change
the Wrangler configuration as part of this inspection.

Record only non-sensitive attestation: review date (UTC), which route classes
and ruleset scopes were inspected, and `observed`, `unverified` or
`not_configured` where independently proven. Do not record rule expressions,
raw hostnames outside fixed Vellira constants, account identifiers or secrets.
No provider quota, shared namespace identity, global budget activation or
public Pro eligibility is granted by this diagnostic change.

The report cannot prove shared Durable Object instance identity.
It also cannot prove effective WAF coverage for each public hostname.
Both claims require separate account-side review before activation.

Run the synthetic no-network contract test with:

```sh
node --test apps/website/scripts/cloudflare-newsletter-account-readonly.test.mjs
```

References:

- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/
- https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/methods/list/
- https://developers.cloudflare.com/api/resources/rulesets/subresources/phases/methods/get/

## Manual private owner provisioning (separately authorized)

The manual-only **Provision Private Newsletter Budget Owner** GitHub Actions
workflow has two operations. It never runs from push, a PR or a schedule.
Its one-time `provision` operation **already succeeded** as run #39608321816.
Do not rerun `provision` now that the private owner exists.

1. From `main`, select `preflight` (default). The job checks the exact
   selected SHA, static isolation guards and pinned Wrangler `--dry-run`,
   without any Cloudflare credentials or API writes.
2. `provision` is **not authorized by merging this workflow**. Only after
   separate owner approval, supply the exact current `main` SHA and type
   `PROVISION_PRIVATE_BUDGET_OWNER`. A protected `production` environment
   review must also be approved before the provisioning job starts.
3. Before its first remote mutation, the provisioning job uses GET-only
   Cloudflare inventory and GitHub current-main checks. It fails closed if
   the target Worker already exists, either site is already bound to a
   global budget, inventory is inconclusive, or `main` has advanced.
4. The sole Cloudflare write is a pinned Wrangler deployment of the
   **private owner candidate**, with no public URL, routes, capacity,
   Buttondown credentials or site binding. A later GET-only audit checks
   that the Worker exists, `workers.dev` and Preview URLs are both OFF,
   and the website Workers remain unbound.

Failure after Wrangler starts may mean the Worker was provisioned even
if postflight verification failed. Never blindly rerun a `provision`
operation: inspect the read-only audit and Cloudflare dashboard first.
Namespace/class identity, provider quota and actual budget enforcement
remain separate proof gates. This workflow does not configure any
provider request, public Pro activation, staging/production binding, or
account-level WAF change. The authoritative Buttondown create quota is
still unverified; the operational budget stays OFF.

## Separate approval sequence

1. **Completed:** offline shared-owner Miniflare proof, pinned Wrangler dry-run
   and private-owner provisioning with a GET-only privacy postflight.
2. **Proposed, not approved for remote rollout:** staging-only external binding
   with fixed OFF mode. Review the exact PR diff, pinned local-cache
   isolation, regression tests and CI before any merge. A website-file merge
   can trigger normal staging deployment.
3. **After an explicitly approved staging deployment:** run Cloudflare's
   GET-only account audit. Confirm staging has the binding in every
   traffic-serving version, the owner has no public URLs, and production
   remains unbound. Binding-name presence does **not** prove the remote
   namespace identity or active admission; obtain separate class/namespace
   evidence without exposing identifiers.
4. Confirm the real Buttondown create quota, accounting window/reset,
   shared provider writers, WAF coverage and reserved capacity.
5. Review no-provider-write synthetic staging tests and explicit ON/OFF
   rollback before any temporary staging activation.
6. Production/global admission and public Pro remain OFF until separate
   authorization and proof.

References:

- https://docs.buttondown.com/api-rate-limits
- https://docs.buttondown.com/api-subscribers-create
- https://developers.cloudflare.com/workers/wrangler/configuration/#durable-objects
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
