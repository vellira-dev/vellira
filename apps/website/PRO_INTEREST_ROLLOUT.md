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
2. In a controlled provider test, verify the exact `tags`, `type: unactivated`
   and `X-Buttondown-Collision-Behavior: add` request, especially for **new,
   existing, previously unsubscribed and suppressed** subscriber states.
   Confirmation must not be silently bypassed or existing consent overridden.
   Test specifically that tagging an already-confirmed `regular` subscriber
   does not downgrade their existing newsletter status to `unactivated`; if
   that transition occurs, leave the flag OFF until the adapter is revised.
   **More importantly, an unauthenticated request for somebody else's existing
   confirmed address must never silently add the Pro-interest tag without
   separate owner confirmation.** Buttondown's documented collision-add policy
   merges tags for existing subscribers; a generic HTTP 200 or current
   `type: unactivated` request is not proof of new topic-specific consent on
   an already-active email. Before rollout, independently verify a safe
   provider-owned opt-in confirmation flow for this case or implement a
   narrowly reviewed verification route; otherwise refuse to tag existing
   subscribers, explain that limitation, and count only proven opt-ins.
   If this cannot be guaranteed, leave the flag OFF. Do not build a shadow
   subscriber database or silently accept spoofed "interest" records.
   If the provider changes semantics, keep the flag OFF and fix the adapter
   before accepting a real Pro-interest address.
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
