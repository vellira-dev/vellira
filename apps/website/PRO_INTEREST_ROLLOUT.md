# Pro launch-interest opt-in — rollout and measurement

This is a **newsletter topic opt-in**, not a Pro purchase, account, trial,
checkout, or statement that Pro is available. It reuses the site's existing
server-only Buttondown subscription provider; there is no new Vellira subscriber
database or user tracking identity.

## Activation (default OFF)

The home Pro panel includes the optional Vellira-native form only when
`NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED=1` is configured **at website build
time**. The existing newsletter API rejects `purpose: 'pro_launch'` with HTTP
503 while the same flag is off. The ordinary engineering-newsletter form and
existing API behavior remain available.

Before enabling for staging or production:

1. Verify Buttondown newsletter API access and confirm **tags** are enabled in
   the actual account/plan. The official tags feature generally needs Buttondown
   Basic or higher. No fallback to an untagged Pro-interest signup is allowed.
2. In a controlled provider test, verify the exact `tags` and
   `type: unactivated` request **without any collision-upsert header**, for
   new, existing, unsubscribed, unactivated and suppressed addresses.
   Buttondown's documented default behavior rejects an existing subscriber
   rather than merging their tags; only a genuinely new, confirmation-pending
   address may acquire the Pro-interest tag via this public endpoint.
   Neither a malicious attempt using someone else's active email nor an
   existing subscriber retry may add Pro interest or change their newsletter
   status. Unknown/success-ambiguous responses must not count as consent.
   **Existing newsletter subscribers cannot opt into the Pro tag via this
   public form in V1.** If we later support them, use a separately reviewed,
   subscriber-authenticated preference change (for example a verified
   subscriber-editable tag in Buttondown Portal), not a public unauthenticated
   PATCH/upsert. Check the actual Buttondown account settings and test every
   state transition before enabling the form; fail closed on unexpected
   provider behavior.
3. Confirm the intended newsletter audiences and **tag-based segmentation** in
   Buttondown. The UI requests engineering notes **and** Pro updates; it does
   not silently opt users into an unrelated marketing list.
4. Review public consent text, Buttondown processing, subscribe confirmations,
   unsubscribe/suppression, provider email settings and the current Privacy
   Policy. Avoid newsletter sends until the intended audience is explicit.
5. Run same-origin/invalid-body/consent, provider-error, repeat-subscription
   and mobile/browser/a11y regression tests, then stage/production smoke.
   Require owner approval and normal production admission for the rollout.

The form never sends credentials to the browser, auto-subscribes visitors,
charges money, creates a Pro entitlement, or activates a paid feature.

## Measurement without a second tracking system

- **Search discovery:** use existing aggregate Search Console queries/pages
  and Cloudflare Web Analytics page/referrer reports; no cross-site identity
  stitching, invisible tracking pixels or extra analytics cookies.
- **Core use:** where available, use documented aggregate package downloads,
  GitHub engagement or verified clean-consumer evidence as **proxies**.
  A view, star, install or download is not proof of real Core use.
- **Pro interest:** use Buttondown's `vellira-pro-launch-interest` tag and count
  only confirmed active subscribers for an interested-audience figure. Pending,
  unsubscribed, suppressed or duplicate addresses are not counted as confirmed
  opt-ins. Never expose raw addresses or correlate them with analytics visitors.
- **Attribution:** article/platform links lead to the published canonical
  vellira.dev URL; Cloudflare aggregate referrers can suggest channels but
  cannot establish which named person later subscribed or bought Pro.
- **Commercial outcome:** real subscriptions, payment and retained product use
  have separate backend/commercial owners. Never infer a conversion rate from
  aggregate referrer and provider audience counts without a validated matched
  measurement method.

Record a dated weekly review of these source-proven metrics and unknowns through
the **existing Growth Intelligence / Content Agent reporting** when that
integration is approved. This file is not a new metric schema or publication
permission.
