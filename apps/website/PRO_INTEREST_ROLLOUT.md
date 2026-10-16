# Pro launch-interest opt-in — Buttondown UTM rollout and measurement

This is an optional **newsletter-topic interest signal**, not a Pro purchase,
account, trial, checkout, product entitlement or proof of future demand.

The website already has one working `/api/newsletter/subscribe` endpoint:
`NewsletterSignupForm` sends an email to the server; the server forwards it
to Buttondown for ordinary double opt-in. We **reuse this identical provider,
credential, endpoint and existing newsletter audience**. Pro does not add
a second subscriber database, an additional newsletter or a marketing pixel.

## Activation — default OFF

The Pro card displays its Vellira-native `Get Pro updates` form only when
`NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED=1` is configured **at website
build time**. The API rejects `purpose: 'pro_launch'` with HTTP 503 while the
flag is OFF. The normal blog newsletter continues unchanged without this flag.

When the flag is ON and the request includes an explicit
`purpose: 'pro_launch'` and `consent: true`, the server adds the **fixed,
server-owned** subscriber attribution `utm_campaign: 'vellira_pro_launch_interest'`
plus `type: 'unactivated'`, rather than any paid `tags` field. This is not
taken from a URL/user-supplied UTM parameter, does not rely on tracking cookies
and does not change the sender or the newsletter audience.

Buttondown's publicly documented subscriber API supports writing
`utm_campaign` at creation and filtering the subscriber list by
`utm_campaign` and lifecycle status:

- https://docs.buttondown.com/api-subscribers-create
- https://docs.buttondown.com/api-subscribers-list

API documentation alone is not rollout evidence. On 2026-10-15 the owner
completed a controlled free-plan local Pro signup using a new address:
Buttondown sent a confirmation email, the owner clicked the confirmation link,
and the account UI showed `Regular` with
`utm_campaign: vellira_pro_launch_interest`. This is an owner-observed
end-to-end case, not evidence of bulk delivery, recipient segmentation, or all
failure modes. The screenshot displayed older-looking dates; do not treat its
date column as evidence of the actual creation time. No extra paid Tags plan is
needed for this tested flow.

## Production rollout gates (manual staging preview is separate)

The owner-observed local UTM/double-opt-in case permits a **short, explicitly
approved staging preview**, not unrestricted public activation. The following
conditions remain mandatory before enabling the form on the public website.
The staging Worker itself is publicly accessible during the controlled test.

1. Confirm in a read-only provider/account review that the existing Buttondown
   credential is still valid and subscriber UTM fields/list filters are actually
   usable on the present free plan. Do not share a secret or email list in a PR,
   conversation or log. No new credential generation or bulk subscriber export.
2. Arrange an **explicitly owner-approved, controlled test** with one new test
   email (not an existing newsletter subscriber): verify ordinary provider
   confirmation, `unactivated → regular` only on email-owner confirmation,
   retention of `utm_campaign` after confirmation, and a provider-side
   `utm_campaign` / `type` filtered count without exposing recipient data.
   No writes to existing subscriber records. Any unsupported operation or
   ambiguous result means feature remains OFF.
3. Test duplicate, already-subscribed, unsubscribed, blocked/suppressed and
   rate-limit paths. **Never use** `X-Buttondown-Collision-Behavior: add` or
   `overwrite`, PATCH existing records from a public signup, or bypass
   Buttondown firewall/confirmation. A public request with someone else's
   email must not alter that person's existing campaign attribution or status.
4. Confirm newsletter confirmation templates, policy wording, privacy
   disclosures and sending audiences. Do not assume UTM gives paid Tags-like
   segmentation or that Pro-only broadcasts are possible on the free plan.
   Current consent covers Vellira engineering notes and occasional Pro news,
   not unrelated marketing or activation of paid features.
5. Recheck exact-head CI, mobile/browser/a11y, legal disclosures, staged
   subscription behavior and standard production admission. Owner approval
   is separate from merge; a merged PR is not authorization to enable the flag.

Existing regular subscribers are intentionally **not** re-attributed as newly
interested in Pro via this form. They can keep receiving general engineering
newsletter updates; a future **subscriber-authenticated** preference path would
require separate consent and implementation.

## Provider failure-mode proof (no subscriber writes)

The website provider adapter has deterministic, **mocked** contract coverage for
the Pro route and the regular newsletter path:

- Existing and pending duplicate addresses cannot be overwritten or
  re-attributed: no `X-Buttondown-Collision-Behavior`, `PATCH`, retry or
  bypass-firewall operation is sent.
- Suppressed, unsubscribed, blocked and complained cases are represented by
  Buttondown's documented `subscriber_suppressed` response. Public callers
  receive a generic unavailable result, not a claim that the address is active.
- Unknown `400` failures, including the documented daily subscriber-creation
  quota, fail closed as temporarily unavailable. `429` is rate-limited;
  unrelated `422` validation failures are not misreported as invalid emails.
- New Pro signup requests retain server-owned `utm_campaign`, require
  `type: unactivated` and never accept caller-provided tags or subscriber type.
  Tests use synthetic addresses and mock responses; no Buttondown credential is
  used and no provider quota is consumed.

**Mocks are not live-provider proof.** The owner-observed single fresh-email
confirmation case above is the only completed live write/confirmation exercise.
Before production, separately verify the free-plan read-only filtered subscriber
count, suppression/duplicate behavior through provider-owned documentation or
safe controlled evidence, email templates, confirmation delivery and consent
wording. Do not deliberately exhaust the provider quota, send bulk probes,
attempt to subscribe someone else's address or mutate a suppressed record.

## Local read-only Buttondown verification (no write API calls)

Run the optional audit on a trusted local machine with your **existing** Buttondown
`BUTTONDOWN_API_KEY` set in the process environment. Never paste the key into
GitHub, a PR, CI variables, the conversation, or an untracked shell transcript.
This is **not** a CI check and does not run automatically on deployment.

From the repository root:

```sh
node apps/website/scripts/buttondown-pro-interest-readonly.mjs
```

When the existing untracked `apps/website/.dev.vars` holds this credential, Node
22 also supports loading it locally without copying the key to GitHub:

```sh
node --env-file=apps/website/.dev.vars apps/website/scripts/buttondown-pro-interest-readonly.mjs
```

Both commands execute **exactly three GET requests** on the official Buttondown
subscriber-list endpoint with fixed server-side filters:
`utm_campaign=vellira_pro_launch_interest`, plus `type=regular` and
`type=unactivated` respectively. They return only aggregate `count` values;
returned email addresses and other subscriber records remain in memory and are
never printed, exported, persisted, or logged. Unknown responses, ignored
filters, invalid counts, network failures and 429s stop without retry.
A positive filtered count with an empty first page also fails closed.
Each query separately reports `first-page-match` when at least one returned
record passes the filter check, or `inconclusive-empty` when zero matches are
returned. Zero matches alone **cannot prove** the provider applied that filter.
These three sequential GETs are not an atomic snapshot: a subscriber's
confirmation transition during the audit may cause temporary differences.

The outputs distinguish confirmed regular interest, unactivated/pending
confirmation, and all other statuses. They do **not** guarantee consent or
separate Pro email segmentation, do not establish a conversion rate, and do not
prove rate-limit, duplicate or suppression behavior for **writes**. If the local
key is missing or read permissions are unavailable, stop: do not generate a new
credential, ask for one in a PR, or add production secrets to GitHub.

The audit has deterministic synthetic-provider tests:

```sh
node --test apps/website/scripts/buttondown-pro-interest-readonly.test.mjs
```

## Pro email consent, confirmation copy, and abuse review

Vellira presents an **unchecked, required Vellira Checkbox** before the Pro
form's submit button. The user must positively agree to receive the single
Vellira engineering newsletter, including occasional Pro launch updates.
The form does not send `purpose: pro_launch` or `consent: true` until the
checkbox is checked; the Worker independently rejects missing/false consent.
Emails remain pending Buttondown double opt-in (`type: unactivated`) until the
mailbox owner confirms. A 201 response is only request acceptance, not
evidence of email delivery or active subscription. The form and shared
newsletter success page use **conditional** confirmation copy; duplicates
must not falsely promise a new confirmation email.

Buttondown's **default** confirmation email is provider-owned and was observed
by the owner in the prior one-address test. Before public activation, verify
its visible newsletter identity, sender, explanation of the opt-in, working
confirmation link and an invitation to ignore unsolicited requests.
Review `Settings > Subscribing > Confirmation` in the Buttondown account if
that panel is available on the current plan. Buttondown documents **custom**
confirmation email templates as a Standard-plan feature; do not purchase
an upgrade or change provider settings to satisfy this Vellira PR.
References:
- https://docs.buttondown.com/double-opt-in
- https://docs.buttondown.com/transactional-emails-confirmation
- https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel

**Security review — not yet an anti-bot proof:** the public shared newsletter
endpoint validates JSON/content length, email format, Pro purpose/consent,
and origin *when provided*; Buttondown itself applies firewall and rate limits.
The endpoint currently accepts requests with a missing Origin header and has
no Vellira-controlled per-actor or per-resource rate limit. Scripts can call
it directly without submitting the form; client-side consent/checkbox and
same-origin checks are not bot defenses. Buttondown's subscriber creation
quota is shared with the existing engineering newsletter.

Before activating the public Pro form, require a **separately reviewed**
abuse-control design and staging proof that bounds unauthenticated requests
to the shared provider endpoint. Do not weaken or unexpectedly block the
existing engineering newsletter. Cloudflare Workers rate-limit bindings
are per-location, eventually consistent, and cannot alone guarantee a
global/day quota. Record the actual controls and their limitations before
separate owner signoff. No rate-limit infrastructure is added by this PR.
## Owner-approved staging-only preview

Use **Actions → Deploy Website Cloudflare Staging → Run workflow → main**.
Check **pro_interest_preview** only for an explicitly approved test. Normal
push-to-main builds and unchecked manual runs keep both the form and Pro API
purpose **OFF**. Checked preview runs fail unless they target `main`.

Preview URL: `https://vellira-website-staging.vellira.workers.dev/#pro`.
This is a **publicly reachable** origin, not a private testing audience.
Keep the test brief, do not advertise the staging URL, and restore OFF as soon
as verification is complete. All requests during the preview use the real
Buttondown account; no extra user signup is automated by the smoke checks.
Staging reuses the existing Cloudflare Worker secret `BUTTONDOWN_API_KEY`;
nothing is copied into git, Actions variables, JavaScript or logs. The live
smoke tests UI visibility and an intentionally rejected API request, with no
real subscriber creation or mutation in either mode. The ordinary engineering
newsletter continues unchanged.

A manually dispatched staging run is **not** eligible for normal production
promotion: the production candidate contract requires a successful `push`
staging run. Independently, standard production builds and the legacy one-time
adoption path explicitly compile
`NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED=0`. Existing production
environment approval is still required.

After inspecting the preview, run the staging workflow **again with the
checkbox unchecked** to restore the public staging Worker to OFF. Confirm
the form is absent and Pro API returns 503. Production remains OFF until
separate owner approval, relevant provider edge-case checks and exact-head
CI/staging evidence; merge is not activation authorization.

## Honest measurement without additional tracking

- **Traffic:** Search Console queries/pages and Cloudflare Web Analytics
  aggregate referrers can indicate organic search, article and GitHub traffic.
  They are not user-level attribution or proof of conversions.
- **Core engagement:** aggregate package download data, GitHub activity and
  verified clean-consumer evidence are _proxies_, not proof of active users.
- **Pro interest:** after a verified provider read-only UTM filter, count **only
  newly confirmed/active subscribers** with campaign
  `vellira_pro_launch_interest`. Pending, suppressed, removed, churned or
  unsubscribed addresses do not count. Never count a successful HTTP 201 as
  confirmed interest before the email confirmation transition is observed.
- **Email delivery:** everyone belongs to the existing newsletter. UTM source
  distinguishes signup context **but does not create a separate recipient
  segment or entitlement**. Avoid sending Pro news to unconsented audiences.
- **Limitations:** aggregate Cloudflare/GSC and provider lists cannot identify
  the same visitor across tools. Counts are source-owned and may lag; do not
  state an exact site → signup conversion rate without validated matching.

If an eventual Growth Intelligence integration is approved, aggregate
read-only counts may feed the existing weekly review; no new metrics store or
secret-bearing event pipeline is authorized by this change.
