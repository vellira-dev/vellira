# Cloudflare website migration

This document is the operational runbook for moving `vellira.dev` from Vercel to Cloudflare Workers.

## Adapter and worker topology

The active Cloudflare adapter is **OpenNext** (`@opennextjs/cloudflare`). Vinext was used only during the initial compatibility experiment and is not part of the active build or deploy path.

Two Workers are intentionally separated:

- Staging: `vellira-website-staging` → `https://vellira-website-staging.vellira.workers.dev`
- Production: `vellira-website` → initially available only through its `workers.dev` hostname

Do not attach `vellira.dev` to the staging Worker. Staging deploys from `feat/website-cloudflare-staging`, so sharing that Worker with production would allow a staging push to change the public site.

The production Wrangler configuration intentionally contains no custom-domain route before cutover. Adding the domain is a separate, explicit production operation.

## Current staging contract

A Cloudflare staging deploy is not considered healthy merely because `next build` or `wrangler deploy` succeeds. The permanent staging workflow must also pass its HTTP and Chromium smoke tests.

The current contract covers:

- `/`
- `/components` and component-to-component navigation on desktop
- component navigation at a representative 670×900 mobile/tablet viewport
- `/blog` and at least three article transitions
- article → `Continue reading` → another article
- MDX syntax highlighting
- `/blog/rss.xml`
- `/sitemap.xml`
- `/robots.txt`
- article views, actor-specific like state, like/unlike mutation and restoration
- graceful article behavior when the metrics backend is unavailable
- absence of `/_vercel/*` requests on the Cloudflare runtime
- browser `pageerror` and same-origin/metrics HTTP 5xx detection

OpenNext must use the Workers Static Assets incremental cache with cache interception so prerendered SSG pages are served from the build-time cache instead of being rendered again inside the Worker.

## Pre-cutover gate

Do not switch the public hostname until all of the following are true:

1. The latest staging deployment is green on a clean dependency graph with OpenNext as the only Cloudflare adapter.
2. The browser smoke suite is green, including blog metrics/CORS and mobile navigation.
3. No intermittent Worker 5xx/limit outcome is reproducible.
4. The latest blocker-class fix has been followed by at least **two consecutive green staging validations**, with no reproducible Worker 5xx/limit regression.
5. The production Worker `vellira-website` has been built from the intended `main` revision and verified on its `workers.dev` hostname before receiving the public domain.
6. The current Vercel production deployment remains intact and its DNS state is recorded for rollback.
7. The previous Cloudflare production Worker version ID, when one exists, is recorded before any replacement deploy.

## Production candidate deployment

Build and deploy the production candidate with `apps/website/wrangler.production.jsonc` so it cannot overwrite the staging Worker.

OpenNext accepts Wrangler configuration options, so the production commands are conceptually:

```bash
pnpm --dir apps/website exec opennextjs-cloudflare build --config=wrangler.production.jsonc
pnpm --dir apps/website exec opennextjs-cloudflare deploy --config=wrangler.production.jsonc
```

Before cutover, this production config must not contain a `routes` entry for `vellira.dev`.

Verify the candidate through its `workers.dev` hostname with the same important public routes. Metrics/CORS must be validated again after the custom domain is attached because the browser Origin changes to `https://vellira.dev`.

## Cutover sequence

1. Confirm the exact `main` revision intended for production and that the matching staging validation is green.
2. Deploy that revision to the separate `vellira-website` Worker without a custom-domain route and smoke-test the candidate.
3. Record the current Vercel DNS records/targets and keep the Vercel project deployed.
4. In Cloudflare Workers, attach the **apex `vellira.dev`** hostname to `vellira-website` as a Custom Domain. Resolve any conflicting existing DNS record only at this step. Do not attach the domain to `vellira-website-staging`.
5. After the domain is serving from Cloudflare, make the custom domain part of the production Wrangler source of truth in a follow-up production configuration change:

```json
"routes": [
  {
    "pattern": "vellira.dev",
    "custom_domain": true
  }
]
```

6. Re-run the post-cutover validation below before considering the migration complete.
7. Keep the Vercel deployment available during the rollback window. Remove Vercel-only runtime dependencies/configuration only after that window has ended.

`www.vellira.dev` is not part of this runbook unless it is explicitly configured and validated separately. The canonical website hostname remains `vellira.dev`.

## Post-cutover validation

Immediately after attaching `vellira.dev`, verify:

- `/`, `/components`, multiple `/components/[slug]`, `/blog`, and multiple `/blog/[slug]`
- desktop and mobile/tablet client navigation
- `Continue reading`
- MDX highlighting
- `/blog/rss.xml`, `/sitemap.xml`, `/robots.txt`
- canonical metadata and Open Graph URLs resolve to `https://vellira.dev`
- article view registration
- aggregate view counts
- actor-specific liked state
- like and unlike mutation
- Share remains usable if metrics are unavailable
- no CORS error from `https://api.vellira.dev`
- no `/_vercel/*` request is emitted by the Cloudflare site
- no Worker 5xx/limit outcome appears in observability
- important redirects still behave as expected

Then enable Cloudflare Web Analytics for the proxied `vellira.dev` hostname using Cloudflare's automatic setup. Do not add extra application JavaScript solely to imitate Vercel Analytics.

Review Core Web Vitals after traffic has accumulated; do not treat an empty immediately-after-cutover dataset as validation.

## Rollback

There are two distinct rollback paths.

### Cloudflare code regression

If `vellira.dev` is already attached to the production Worker and the problem is limited to a newer Worker version, roll the `vellira-website` Worker back to the last known-good Cloudflare version. Cloudflare supports rollback to a recent published Worker version and makes the selected version active immediately.

After rollback, repeat the critical HTTP/browser smoke checks.

### Cloudflare/domain migration regression

If the problem is with the first Cloudflare production version, Custom Domain, DNS, TLS, or the Workers platform path itself:

1. Detach/disable the `vellira.dev` Custom Domain from `vellira-website` as appropriate.
2. Restore the exact pre-cutover DNS configuration recorded for Vercel.
3. Verify that the retained Vercel deployment is again serving `vellira.dev`.
4. Re-run the critical public-route and blog metrics checks.

Do not delete the Vercel project or its known-good deployment until the rollback window has completed successfully.

## Analytics and Vercel cleanup

While Vercel remains the rollback target, `@vercel/analytics` may remain installed but must render only when `process.env.VERCEL === '1'`. Cloudflare browser smoke fails if a `/_vercel/*` request appears.

After the Cloudflare production rollback window:

- verify Cloudflare Web Analytics is collecting the intended public signals;
- verify metrics/CORS on the final `vellira.dev` origin one more time;
- remove Vercel-specific dependencies, environment assumptions and deployment configuration that are no longer required;
- close the migration/analytics follow-up issues only after those production checks pass.

## References

- OpenNext Cloudflare CLI: https://opennext.js.org/cloudflare/cli
- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Workers rollbacks: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Cloudflare Web Analytics setup: https://developers.cloudflare.com/web-analytics/get-started/
