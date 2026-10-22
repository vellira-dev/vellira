# Newsletter abuse guard — staged burst control (issue #1712)

This design protects the existing **shared** `POST /api/newsletter/subscribe`
path, which serves both the engineering newsletter and optional Pro interest.
It does not create a new subscriber store, enable paid Buttondown features,
change confirmation flows, or activate the public Pro form.

## Threat model and routing

- The public newsletter endpoint is callable by scripts, including requests
  with no `Origin` header. Client-side forms, Checkbox and validation alone
  cannot bound malicious traffic.
- Rate enforcement happens **at the Cloudflare Worker entry**, before OpenNext
  and before any call to Buttondown. It applies to all POSTs on the shared
  endpoint, independent of `purpose`, `email`, or user-supplied attribution.
  A caller cannot obtain another budget by omitting Pro-specific fields.
- The key for an individual actor uses **Cloudflare-provided**
  `CF-Connecting-IP` only. `X-Forwarded-For` and caller-controlled
  `Origin`, `email` and `purpose` are not trusted for limiter identity.
  Missing or invalid CF IP maps to a shared `unknown` actor bucket; it does
  not receive unlimited traffic.
- Nothing logs subscriber email, client IP, rate-limit key, API token or
  Buttondown response body. The existing Worker emits only metadata (request
  ID, path, method, status and build identity).
- A denied request returns HTTP 429, `Retry-After: 60`, a safe
  `rate_limited` code and `Cache-Control: no-store`. Missing or malformed
  bindings, errors, or invalid runtime mode fail closed as HTTP 503 when ON.
  No retry of a subscriber creation request is performed by the Worker.

## Narrow the public subscriber-write entrypoints (review-only)

The website Workers must retain their stable `workers.dev` origins for
Cloudflare archive-before-activation, local/remote runtime identity, browser
migration and recovery checks. Do **not** turn off `workers_dev` or put
Cloudflare Access in front of the entire Worker: that would break existing
diagnostic and staging smoke requests.

A proposed upstream-write gate in the newsletter **server handler** rejects
valid subscriber-create candidates arriving on any `*.workers.dev` hostname
**before** reading `BUTTONDOWN_API_KEY`, obtaining Durable Object admission
or calling Buttondown. It uses the incoming Request URL hostname, not
user-controlled `Origin` or forwarding headers. It affects both the ordinary
newsletter and future Pro purpose equally. Canonical public
`https://vellira.dev` is unchanged; its ordinary signup path remains
available according to existing consent and provider handling.

The existing staging smoke still needs malformed-address and missing-consent
requests on `vellira-website-staging.vellira.workers.dev`. Those requests
must continue to return `400` **without any provider write**, whereas a
well-formed address on `workers.dev` must fail with `503` and `no-store`
before touching either the provider or global budget. A Pro OFF request
also remains `503`, with no subscriber creation. This gate does not close
any diagnostic GET/HEAD routes or static assets.

**Security boundary:** This is a **provider-create protection**, not
authentication, DDoS filtering, per-IP fairness or a verified global daily
limit. It does not prevent incoming HTTP traffic or Worker execution on
`workers.dev`, and it does not make the still-public canonical newsletter
endpoint safe from malicious account-quota consumption. The zone WAF rule is
currently Disabled; neither a zone rule nor existing local Cloudflare
Rate Limiting bindings can guarantee a global provider account quota.

**Rollout HOLD:** Draft code alone changes no remote traffic. Merging
`apps/website/**` may automatically deploy staging and subsequently offer
an independently protected production promotion. Review exact-head CI,
unit tests for both `workers.dev` hosts and forwarded-header attempts,
no-provider-write staging probes, and the normal website runtime/browser
checks before authorizing any staging rollout. Production promotion remains
a separate decision. Do not use real email addresses to test this boundary.
Cloudflare Zero Trust onboarding is not necessary for this narrow control;
future broader Access policies must be separately approved and evaluated
against CI/recovery requirements.

## Limits and deliberately incomplete guarantees

The first staging-only configuration uses two built-in Cloudflare Worker
Rate Limiting bindings:

- Shared newsletter route: namespace `1712202601`, 12 attempts per 60 s.
- Per Cloudflare IP / unknown bucket: namespace `1712202602`,
  4 attempts per 60 s.

The counters are **per Cloudflare location and eventually consistent**.
Concurrent requests may temporarily exceed either limit, and the same actor
may reach another Cloudflare location. These are deliberately **burst
controls**, **not** a globally exact 100/day budget. Buttondown independently
defaults to 100 requests per day on `POST /v1/subscribers` and may return a
provider-specific HTTP 400 on exhaustion. The ordinary newsletter and Pro
interest still share that upstream account budget. Production activation
requires a separate explicit decision on whether to implement an accurate
globally shared daily budget (e.g. a Durable Object), as well as traffic/WAF
observability and protections against distributed abuse.

## Staging only, default OFF

- Canonical staging Wrangler config has `NEWSLETTER_ABUSE_GUARD_ENABLED=0`
  plus the two limiter bindings. Normal push-to-main builds and ordinary
  manual runs leave it **OFF**.
- Production Wrangler configuration has **no new binding or activation flag**.
  Production remains unchanged. Public Pro interest remains **OFF**.
- A designated owner can separately choose `newsletter_abuse_preview=true`
  in the **Deploy Website Cloudflare Staging** workflow, on `main` only.
  Never enable `pro_interest_preview` during this abuse-guard proof. The
  staging configuration step now **rejects both preview flags being ON**
  before any remote deployment operation. A Pro-only preview remains
  permitted when the guard mode is OFF. The workflow temporarily sets only
  the staging Wrangler variable to `1` on its ephemeral runner; it does
  not commit the change.
- The staging smoke sends malformed addresses only, which the existing
  server rejects before provider creation. OFF expects one 400/invalid_email.
  ON sends at most 32 such calls and requires an observed 429/rate_limited,
  with no subscriber writes. The 429 is a bounded empirical check, **not**
  evidence of global rate accuracy, all-colo enforcement, or perfect protection.
- Staging is still a **public origin** and uses the real Buttondown account.
  The ON preview is not an invitation to generate live subscriber requests.
  A failed smoke **does not automatically roll back** a deployed ON Worker.

## Required controlled rollout

1. Obtain separate explicit owner approval for staging preview. First verify
   all exact-head CI checks and a green default-OFF staging deployment.
2. Use the checked `newsletter_abuse_preview` input **only on main**,
   leaving `pro_interest_preview` unchecked. Inspect the no-write smoke and
   request logs for HTTP 400 → 429 and proper no-store behavior; verify
   normal newsletter UI and all existing staging smoke checks.
3. Restore OFF promptly by running the **same staging workflow with both
   preview checkboxes unchecked**. Confirm OFF smoke. This restoration is
   required even if the ON workflow fails after remote deployment.
4. Inspect any Cloudflare account WAF/rate rules separately. Do not assume a
   WAF rule on `vellira.dev` covers `workers.dev` or production custom domains.
5. Before production enforcement, decide global daily-budget and distributed
   abuse handling, validate rate thresholds against legitimate use, add
   production binding wiring in a distinct reviewed PR, and obtain owner
   approval. **Do not enable public Pro solely because this PR is merged.**

## Provider-write-free test contract

Run `pnpm test:cloudflare-cache` to execute the deterministic guard,
Worker integration, preview authorization and local no-write smoke tests.
Tests use synthetic addresses and fake limiter bindings. No Buttondown key,
new subscriber, provider write API call or production activation is required.

References:

- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/local-development/bindings-per-env/
- https://docs.buttondown.com/api-rate-limits
- https://github.com/vellira-dev/vellira/issues/1712
