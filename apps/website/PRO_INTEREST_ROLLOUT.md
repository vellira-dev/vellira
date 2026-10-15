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
