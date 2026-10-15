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

**This is only API-schema evidence, NOT proof of entitlement or behavior on the
actual free Buttondown account.** Do not enable the form based on the docs or
synthetic tests alone. Do not pay for Basic/Tags as part of this experiment.

## Preconditions before staging or production activation

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

## Honest measurement without additional tracking

- **Traffic:** Search Console queries/pages and Cloudflare Web Analytics
  aggregate referrers can indicate organic search, article and GitHub traffic.
  They are not user-level attribution or proof of conversions.
- **Core engagement:** aggregate package download data, GitHub activity and
  verified clean-consumer evidence are *proxies*, not proof of active users.
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
