# Cloudflare website migration

This document is the operational runbook for the Vellira website on Cloudflare Workers and records the completed Vercel → Cloudflare cutover contract.

The [deployment/cache contract](../../docs/architecture/cloudflare-deployment-cache-contract.md) defines the cache, identity and immutable-asset architecture. The [PR #943 review record](../../docs/architecture/cloudflare-pr943-review.md) preserves the earlier migration baseline, and the [Safari checklist](../../docs/architecture/cloudflare-safari-validation.md) owns real-Safari gaps and reproduction.

## Current production state

The public cutover is complete and the rollback window is closed. Cloudflare is the only supported website production hosting path. The former Vercel website project and its domain/deployment bindings were removed on 2026-09-12 after the Cloudflare custom-domain, runtime, archive, metrics, navigation and static-asset postflight had been proven in production.

The active adapter is **OpenNext** (`@opennextjs/cloudflare`). Vinext was used only during the initial compatibility experiment and is not part of the active build or deploy path.

Workers and hostnames are intentionally separated:

- Staging: `vellira-website-staging` → `https://vellira-website-staging.vellira.workers.dev`
- Production Worker diagnostic origin: `vellira-website` → `https://vellira-website.vellira.workers.dev`
- Public canonical production origin: `https://vellira.dev`
- Public alias: `https://www.vellira.dev` → permanent `308` redirect to the canonical apex, preserving path and query

Never attach either public hostname to the staging Worker.

The production Wrangler configuration is the source of truth for both custom domains. The production Worker owns the `www` redirect and emits the same deployment identity headers on that response as on the apex runtime.

## Proven production evidence

PR #1010 made the live custom-domain checks part of the permanent production postflight rather than relying only on the Workers.dev diagnostic origin.

The first fully qualifying normal production deployment after that change is:

- workflow: `Deploy Website Cloudflare Production`
- run: `34696914280`
- source revision: `dd472fd4cc922d736d01ea78d026a0d0425a14cd`
- result: success

That run passed the R2 predecessor/archive gate, OpenNext build and runtime checks, same-origin multi-deployment migration tests, production activation, Workers.dev identity/freshness checks, live `vellira.dev` runtime stabilization, live `www → 308` identity/redirect contract, browser metrics/navigation smoke on the public apex, the long navigation/static-asset soak, static chunk integrity and forensic evidence retention.

This run is qualifying production deployment **#1** for the proving window required by #1005. Do not graduate to approval-gated automatic production deployment until the full 2–3 consecutive normal-deployment requirement in #1005 is satisfied.

## Staging contract

A Cloudflare staging deploy is not healthy merely because `next build` or Worker activation succeeds. The permanent staging workflow must pass the complete exact-head contract.

It includes:

- early R2/predecessor preflight;
- installed/shipped Next patch and build identity checks;
- complete asset closure and archive verification;
- local OpenNext runtime;
- Chromium/Firefox/WebKit migration coverage;
- live HTML/RSC freshness and exact asset byte/MIME/cache assertions;
- `/`, `/components`, component navigation, `/blog` and multiple article transitions;
- MDX syntax highlighting;
- `/blog/rss.xml`, `/sitemap.xml`, `/robots.txt`;
- same-origin aggregate and actor blog metrics;
- like/unlike mutation, actor-state continuity and repeated same-day no-op behavior;
- graceful article behavior if the metrics backend is unavailable;
- absence of Cloudflare-runtime `/_vercel/*` requests;
- browser `pageerror`, same-origin 5xx and metrics failure detection;
- full navigation/static-asset soak and static-chunk integrity.

All evidence must belong to the same exact Git SHA. A green deploy step with skipped browser, metrics or soak validation is not a green staging validation.

OpenNext must continue to use Workers Static Assets incremental cache with cache interception so prerendered SSG pages use the build-time cache instead of being regenerated inside the Worker.

## Supported deployment entry

Use the repository workflows. They install frozen dependencies, validate remote R2 and the live predecessor before activation, build with:

```text
VELLIRA_BUILD_ID=<full SHA>-<run ID>-<run attempt>
```

and run the required preactivation and postactivation checks.

The guarded deployment entry is:

```sh
node apps/website/scripts/cloudflare-deploy.mjs wrangler.production.jsonc
```

The config argument is relative to `apps/website`. The website `deploy:opennext` package script is an alias for this guarded entry, not permission to bypass the workflow.

Inside the guarded entry, the expected order is: parse/validate the target; populate OpenNext route-cache assets; verify installed/shipped patch, identities, cache namespaces, headers and runtime graph; identify the live predecessor and require its complete archive; create-only archive/read-back the current immutable assets; write deployment evidence and build seal; Wrangler dry-run; activation. No unguarded OpenNext mutation follows the archive gate.

Do **not** use upstream `opennextjs-cloudflare deploy`, direct `wrangler deploy`, a reused generated seal, or manual dashboard deployment as a validation-equivalent production path. Missing archive access, a missing predecessor manifest, collision or unavailable original artifact is a blocker.

## Production postflight contract

The production workflow deliberately uses two origins for different purposes:

- `vellira-website.vellira.workers.dev` remains the internal diagnostic/archive/runtime-contract origin;
- `vellira.dev` is the user-facing origin for browser metrics/navigation smoke, navigation soak and static-chunk integrity.

After activation, `cloudflare-runtime-contract.mjs` also receives `PRODUCTION_PUBLIC_URL` and `PRODUCTION_WWW_URL` and must prove:

- the apex converges to the expected current `VELLIRA_BUILD_ID` and a stable Worker version;
- `www.vellira.dev/<path>?<query>` returns exactly `308`;
- the redirect points to `https://vellira.dev/<path>?<query>` without losing path/query;
- the redirect executes on the expected current build and exposes Worker-version identity;
- the redirect has no response body.

The browser postflight on the apex must continue to verify:

- key public routes and client navigation on desktop/mobile;
- MDX highlighting and Continue reading transitions;
- article aggregate views and actor-specific liked state through the same-origin proxy;
- view registration and reversible like mutation;
- actor continuity across reloads and same-day view/like idempotency;
- article/share usability when metrics are unavailable without fake zero state;
- no direct browser metrics calls to `api.vellira.dev`;
- no `/_vercel/*` runtime request;
- no unexpected same-origin 5xx, page errors or failed same-origin requests;
- long-lived client navigation/static-asset compatibility across the stale-time window;
- exact static-chunk integrity.

## Cloudflare Web Analytics

Cloudflare Web Analytics is the public traffic/content/performance layer for the final `vellira.dev` production site. Because the hostname is proxied through Cloudflare, use **Automatic Setup** in the Cloudflare dashboard by default. Do not add a manual analytics beacon to the application unless Automatic Setup is shown to be incompatible with the production response path.

Dashboard setup/verification:

1. Open Cloudflare dashboard → **Analytics & Logs → Web Analytics**.
2. Add/select the proxied `vellira.dev` hostname.
3. Confirm **Automatic Setup** is enabled in **Manage site**.
4. Leave the default all-pages rule unless a deliberate analytics-scope decision requires exclusions.
5. After real traffic has accumulated, verify visits/page views and page-level data are appearing.
6. Verify the dashboard exposes the intended Vellira signals: popular pages, referrers/traffic sources, countries, device classes, browsers/OS and Core Web Vitals.
7. Verify Core Web Vitals include LCP, INP and CLS where browser support allows them.
8. Confirm client-side/soft navigations are represented; Cloudflare Web Analytics supports SPA-style navigations automatically.

Do not treat an empty immediately-after-enablement dashboard as failure; Web Analytics data can take time and requires actual visits.

Automatic injection is intentionally not a fragile CI requirement. Browser extensions/privacy tooling, regional configuration and Cloudflare injection behavior can affect whether the beacon is visible to a particular request. The durable requirement is that Automatic Setup is configured in the dashboard and that production data is observed there after traffic accumulates.

If Automatic Setup is configured but no data arrives, check Cloudflare's documented injection blockers before changing application code. In particular, a `Cache-Control: public, no-transform` response prevents Cloudflare from modifying HTML to inject the beacon. The current Vellira HTML cache contract should not be weakened merely to force analytics injection.

### Analytics ownership

Keep these three systems separate:

- **Cloudflare Web Analytics** → public traffic, content discovery and real-user performance;
- **Cloudflare Worker Analytics / observability** → infrastructure health, request volume, errors, status and latency;
- **Vellira blog metrics** → product-owned article views, likes and actor-specific liked state.

Cloudflare Web Analytics complements Vellira blog metrics; it does not replace them. Do not add user-level identity tracking, cookies, local storage or PII collection merely to reproduce the retired Vercel Analytics behavior.

## Backend CORS and application metrics

Production CORS must remain explicit and minimal. The required website origins are the public apex, public `www` alias and the isolated staging Worker origin. Do not replace the allowlist with `*`.

The permanent production browser smoke is the regression gate for final-origin metrics/CORS behavior. A deployment is not qualifying if likes/views only work on Workers.dev while failing on `vellira.dev`.

## Rollback

The supported website rollback path is Cloudflare-only.

### Cloudflare code regression

Use only an earlier validated Cloudflare deployment that retains the current request/response cache policy, HTML freshness and append-only asset fallback. Retain newer asset graphs. A pre-contract Worker is not a safe rollback merely because it once served successfully.

The guarded deployment entry does not make a dashboard/direct CLI rollback validation-equivalent. Coordinate any emergency version rollback separately and preserve identity, predecessor/archive and target-serialization evidence. After rollback, repeat the critical HTTP/browser checks.

### Hosting/platform incident

Vercel is no longer retained as a website fallback and must not be treated as an emergency deployment target. A platform-level recovery must use the documented Cloudflare deployment/archive evidence and an explicitly reviewed recovery action rather than silently recreating the retired Vercel production path.

## Vercel decommission status

The Vercel rollback window is closed. The `vellira-website` Vercel project, its Git deployment integration and its website domain/deployment bindings were removed on 2026-09-12.

Repository cleanup after decommission must maintain these contracts:

- no Vercel Analytics runtime integration or `process.env.VERCEL` website behavior;
- no Vercel website deployment workflow or configuration;
- no Vercel-hosted website fallback claim in active runbooks;
- Cloudflare remains the only supported public website hosting/deployment path;
- negative regression guards such as asserting that Cloudflare emits no `/_vercel/*` requests may remain because they protect the Cloudflare runtime rather than depend on Vercel;
- historical migration records may mention Vercel when clearly identified as historical evidence;
- unrelated tooling must be audited independently rather than removed by string match. Vercel Turbo Remote Cache was already retired from CI before this hosting decommission.

Issue #903 owns the remaining Vercel-specific runtime/config cleanup and #1001 owns final hosting/account-level closure.

## References

- OpenNext Cloudflare CLI: https://opennext.js.org/cloudflare/cli
- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Workers rollbacks: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Cloudflare Web Analytics setup: https://developers.cloudflare.com/web-analytics/get-started/
- Cloudflare Web Analytics for SPAs: https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/
- Cloudflare Core Web Vitals: https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/
