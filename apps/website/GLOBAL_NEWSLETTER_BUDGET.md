# Global newsletter upstream admission budget — contract proposal

Status: **design-only / no runtime enforcement**. Tracking: #1728, parent #1712.

## Boundary and invariants

The ordinary engineering newsletter and future Pro interest both invoke the same
`POST /api/newsletter/subscribe` and share one Buttondown subscriber-create account
budget. The existing Cloudflare burst guard (4/60 by Cloudflare IP, 12/60 route,
per colo) stays in front of the Worker/Next handler, but is not a global budget.

The proposed global budget lives at the **last trusted boundary before the
provider call**, not solely at the Worker entry: rejecting malformed email at the
handler should not spend provider capacity. Every code path able to submit a
subscriber create must request global admission, regardless of purpose or
Origin; no caller-provided identity, header or purpose can select a fresh
budget. Inventory all create paths and direct provider clients before wiring.

A single named Cloudflare Durable Object (DO), keyed by the Buttondown account/
credential scope, serializes atomic admission. Multiple DO ids, deployments,
staging/production bindings or renamed instances must **not** accidentally
form independent budgets for one real account. Treat cross-environment sharing
as a blocking architecture decision: DO namespace ownership, migration,
binding access and blast radius need explicit review.

### Failures, accounting and concurrency

* A valid request receives an **atomic, durable, monotonic spend** before any
  subscriber-create attempt. No two concurrent callers can spend the same
  slot. A durable transaction must complete before admission is returned.
* The spend is **not refunded** on network timeout, provider 4xx/5xx,
  cancellation, worker restart, or ambiguous outcome. The provider may have
  accepted a create despite a lost response. This is a conservative
  at-most-budget-attempts guarantee, not exactly-once subscriber creation.
* If admission/storage is unavailable or the budget is exhausted, deny
  **before the provider call**, with no automatic create retry. Distinguish
  temporary unavailability (503) from quota exhaustion (429) using no-store,
  generic non-enumerating responses. Do not log email, IP, provider payload,
  credentials or subscriber existence.
* Never automatically refund an unused admission unless a separately reviewed
  proof establishes that no provider request could have been issued; v1 may
  leave unused permits spent. Crash after admission may sacrifice capacity,
  but must not exceed the quota.
* Avoid rolling-over a time window on local runner/colo clocks. Window/reset
  authority must come from a documented provider rule or a conservative
  monotonic window; prevent abrupt resets while outstanding admissions
  still exist. Account for Cloudflare DO persistence and reset/migration.
* Retrying a client request may consume another permit. Do not claim
  idempotency unless provider-supported deduplication is separately verified.

## Not yet decided (must block runtime implementation)

1. **Provider capacity:** verify actual Buttondown quota for the active plan,
   whether it counts attempts/successes, its reset semantics, and whether
   other writers share the same API token/account. The documented default
   of roughly 100 subscriber-create requests/day is NOT an operational
   guarantee.
2. **Budget ownership:** whether staging and production share the same
   provider account and how both reach one DO instance. If this cannot be
   guaranteed, prefer keeping global enforcement OFF over false assurances.
3. **Window and reserve:** choose a conservative limit below the verified
   shared provider budget, leaving headroom for non-Vellira writers and
   legitimate engineering newsletter demand. Avoid a malicious request
   exhausting all capacity and starving the ordinary newsletter.
4. **Placement:** identify the exact single provider-write call path in
   Next/OpenNext and how it obtains the DO binding without bypass; ensure
   no open gate remains for no-purpose calls or alternate endpoints.
5. **WAF / fairness:** inspect zone, custom-domain and workers.dev controls;
   a global counter alone does not protect legitimate users from adversarial
   quota exhaustion.

## Required deterministic verification before any staging activation

- Simultaneous N+1 admissions against one quota admit **at most N**, even
  when callers originate in simulated independent colos.
- Shared account, absent purpose, Pro and regular newsletter all use exactly
  the same key and budget; malformed input incurs no provider write.
- Exhaustion returns 429 with `Cache-Control: no-store` and no downstream
  call. Coordinator unavailable or corrupt state fails closed (503).
- Time boundary, reset semantics and monotonic durable storage under
  concurrent admission and crash/restart are covered.
- A timeout/ambiguous upstream outcome **does not refund**; repeated create
  requests cannot exceed admitted attempt count.
- Observability contains aggregate outcome counts only, never subscriber
  identifiers or sensitive payloads.
- Dry-run staging uses synthetic/mock provider only. Any ON/OFF deployment
  requires separate owner approval, provider-write-free smoke, rollback and
  verified OFF restoration. Production config and public Pro remain OFF.

## Deferred, explicit non-goals

No subscriber store, no account-wide daily promise from per-colo burst
bindings, no production binding or provider write in this design PR, and
no claim of exactly-once delivery.
