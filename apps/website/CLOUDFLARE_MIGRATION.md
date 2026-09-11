# Cloudflare website migration

This document is the operational runbook for moving `vellira.dev` from Vercel to Cloudflare Workers.

The [deployment/cache contract](../../docs/architecture/cloudflare-deployment-cache-contract.md)
defines the existing architecture. The [PR #943 review record](../../docs/architecture/cloudflare-pr943-review.md)
pins the successful `dbcaea97…` baseline and distinguishes it from later exact-head validation.
Real-Safari gaps and reproduction are in the [Safari checklist](../../docs/architecture/cloudflare-safari-validation.md).

## Adapter and worker topology

The active Cloudflare adapter is **OpenNext** (`@opennextjs/cloudflare`). Vinext was used only during the initial compatibility experiment and is not part of the active build or deploy path.

Two Workers are intentionally separated:

- Staging: `vellira-website-staging` → `https://vellira-website-staging.vellira.workers.dev`
- Production: `vellira-website` → `https://vellira-website.vellira.workers.dev`, plus the public Custom Domains `vellira.dev` and `www.vellira.dev`

Do not attach `vellira.dev` or `www.vellira.dev` to the staging Worker. Automatic staging pushes use `feat/website-cloudflare-staging`; manual workflow dispatch can select another reviewed ref. Sharing that Worker with production would allow a staging deployment to change the public site.

The production Wrangler configuration is now the source of truth for both public Custom Domains. `vellira.dev` is the canonical hostname; `www.vellira.dev` is accepted by the Worker only to return a permanent `308` redirect to the apex while preserving path and query.

## Current staging contract

A Cloudflare staging deploy is not considered healthy merely because `next build` or `wrangler deploy` succeeds. The permanent staging workflow must also pass its HTTP and Chromium smoke tests.

It must also pass early R2/predecessor preflight, installed/shipped Next patch and
build identity checks, complete asset closure and archive verification, local
OpenNext runtime, the Chromium/Firefox/WebKit migration matrix, live HTML/RSC
freshness and exact asset byte/MIME/cache assertions, and the full navigation soak.
All evidence must refer to the same final Git SHA; a green deploy step with skipped
metrics or soak is not a green staging validation.

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
- aggregate counters through the same-origin proxy, with no direct browser metrics calls to `api.vellira.dev`
- article views, actor-specific like state, like/unlike mutation and restoration, liked-state continuity across reloads and repeated same-day view/like no-ops
- graceful article behavior when the metrics backend is unavailable
- absence of `/_vercel/*` requests on the Cloudflare runtime
- browser `pageerror` and same-origin/metrics HTTP 5xx detection

OpenNext must use the Workers Static Assets incremental cache with cache interception so prerendered SSG pages are served from the build-time cache instead of being rendered again inside the Worker.

## Pre-cutover gate

The public cutover has been completed, but the historical gate remains useful when reviewing rollback or migration evidence. Before the public hostname was switched, all of the following were required:

1. The latest staging deployment was green on a clean dependency graph with OpenNext as the only Cloudflare adapter.
2. The browser smoke suite was green, including blog metrics/CORS and mobile navigation.
3. No intermittent Worker 5xx/limit outcome was reproducible.
4. The exact final commit had **two consecutive complete green staging validations**, with distinct SHA/run/attempt build identities, the second verifying the first as its archived predecessor, and no reproducible Worker 5xx/limit regression.
5. The production Worker `vellira-website` had been built from the intended `main` revision and verified on its `workers.dev` hostname before receiving the public domain.
6. The current Vercel production deployment remained intact and its DNS state was recorded for rollback.
7. The previous Cloudflare production Worker version ID, when one existed, was recorded before replacement deploys.

## Supported deployment entry and staging procedure

Use the repository workflow. It installs frozen dependencies, checks remote R2
and the live predecessor before building, builds with
`VELLIRA_BUILD_ID=<full SHA>-<run ID>-<run attempt>`, and runs all preactivation tests.
Do not fabricate GitHub identity variables for a local production deployment.

From the repository root, after confirming the intended PR HEAD:

```sh
gh workflow run deploy-website-cloudflare-staging.yml \
  --repo vellira-dev/vellira --ref <reviewed-ref>
```

Record the run ID and verify its `headSha` equals the intended final commit.
Wait for the entire workflow to succeed, including metrics, soak and static-chunk
smoke, before dispatching another validation on the unchanged ref. Confirm no other
deployment intervened and the later run's `archive-evidence.json.previousBuildId`
equals the earlier run's build ID. Preserve forensic artifacts before expiry.
The target-Worker concurrency group serializes workflow runs, not manual CLI or
dashboard actions; do not use those competing paths during validation.

The workflow's activation command is:

```sh
node apps/website/scripts/cloudflare-deploy.mjs wrangler.jsonc
```

The config argument is relative to `apps/website`, regardless of the shell cwd.
The website `deploy:opennext` package script is an alias for this same guarded
entry, not the upstream OpenNext deploy command. The entry is **not a complete
replacement for the workflow**: it expects the build and preceding tests.

Inside this entry, in order: remove any old build seal; parse/validate the target;
populate OpenNext route-cache assets locally; verify installed/shipped patch,
identities, cache namespaces, headers and complete runtime graph; identify the
live predecessor and require its complete archive; create-only archive/read-back
all current immutable assets and record the deployment manifest; write evidence
and the new seal; run Wrangler dry-run; run Wrangler activation; then require a
short post-activation stabilization window in which multiple uncached runtime
probes consecutively agree on the new build identity and one Worker version.
Only after that gate returns may the workflow begin strict postactivation checks.
No OpenNext mutation follows the archive gate.

Do **not** invoke upstream `opennextjs-cloudflare deploy`, direct `wrangler deploy`,
or reuse a generated seal to bypass this contract. A seal is a build-time guard,
not an account permission boundary. Missing archive access, a missing predecessor
manifest, collision or unavailable original artifact is a blocker: never skip
`requireArchivedDeployment`, replace historical bytes with a rebuild, or rewrite
R2 metadata merely to align Content-Type strings. See the archive-only backfill
procedure in the deployment/cache contract.

## Production deployment

Build and deploy production with `apps/website/wrangler.production.jsonc` so it cannot overwrite the staging Worker.

Only the `Deploy Website Cloudflare Production` workflow is supported. It requires
`main` and explicit `DEPLOY_PRODUCTION` confirmation. Its activation step calls
`node apps/website/scripts/cloudflare-deploy.mjs wrangler.production.jsonc`, after
the same build, archive and browser gates used by the production contract. A
missing production predecessor/archive requires explicit provenance-backed
onboarding before activation.

The production configuration must retain exactly these public Custom Domains:

```jsonc
{
  "routes": [
    {
      "pattern": "vellira.dev",
      "custom_domain": true
    },
    {
      "pattern": "www.vellira.dev",
      "custom_domain": true
    }
  ]
}
```

`workers.dev` remains enabled as the stable deployment/diagnostic origin used by the archive and runtime gates. Public browser validation must additionally cover the apex hostname because its Origin is `https://vellira.dev`.

## Cutover sequence

The public cutover was executed as a separate operator-controlled operation after the isolated production adoption/recovery completed.

1. Confirm the exact `main` revision intended for production and that the matching staging validation is green.
2. Deploy that revision to the separate `vellira-website` Worker and smoke-test the candidate through `workers.dev`.
3. Record the Vercel DNS records/targets and keep the Vercel project deployed for rollback.
4. Attach the apex `vellira.dev` hostname to `vellira-website` as a Custom Domain, resolving only the conflicting Vercel DNS record for that hostname.
5. Verify `/BUILD_ID`, `/__vellira_runtime`, public routes, browser navigation and metrics on the apex before changing `www`.
6. Attach `www.vellira.dev` to the same production Worker, then verify it reaches the same build and Worker version.
7. Codify both domains in `wrangler.production.jsonc` and enforce the canonical-host redirect in Worker code.
8. Re-run the post-cutover validation below before considering the migration complete.
9. Keep the Vercel deployment available during the rollback window. Remove Vercel-only runtime dependencies/configuration only after that window has ended.

The final host contract is:

```text
https://vellira.dev/<path>?<query>      → canonical content
https://www.vellira.dev/<path>?<query>  → 308 → https://vellira.dev/<path>?<query>
```

## Post-cutover validation

Immediately after attaching the public domains, verify:

- `/`, `/components`, multiple `/components/[slug]`, `/blog`, and multiple `/blog/[slug]`
- desktop and mobile/tablet client navigation
- `Continue reading`
- MDX highlighting
- `/blog/rss.xml`, `/sitemap.xml`, `/robots.txt`
- canonical metadata and Open Graph URLs resolve to `https://vellira.dev`
- `www.vellira.dev` returns `308` to the corresponding apex URL while preserving path and query
- article view registration
- aggregate view counts
- actor-specific liked state
- like and unlike mutation
- Share remains usable if metrics are unavailable
- no CORS error from `https://api.vellira.dev`
- no `/_vercel/*` request is emitted by the Cloudflare site
- no Worker 5xx/limit outcome appears in observability
- `/BUILD_ID` and `/__vellira_runtime` identify the expected production build/Worker

Then enable Cloudflare Web Analytics for the proxied `vellira.dev` hostname using Cloudflare's automatic setup. Do not add extra application JavaScript solely to imitate Vercel Analytics.

Review Core Web Vitals after traffic has accumulated; do not treat an empty immediately-after-cutover dataset as validation.

## Rollback

There are two distinct rollback paths.

### Cloudflare code regression

If a separately authorized future rollback is needed, select only an earlier
validated deployment retaining the request/response cache policy, HTML freshness
and append-only asset fallback. A pre-contract Worker is not a safe rollback.
Retain newer asset graphs too. The present guarded build/deploy entry does not
implement a version-rollback command; do not present a dashboard/direct CLI
rollback as a validation-equivalent path. Coordinate it separately and preserve
identity, predecessor/archive and target-serialization evidence.

After rollback, repeat the critical HTTP/browser smoke checks.

### Cloudflare/domain migration regression

If the problem is with the first Cloudflare production version, Custom Domains, DNS, TLS, or the Workers platform path itself:

1. Detach/disable the `vellira.dev` and `www.vellira.dev` Custom Domains from `vellira-website` as appropriate.
2. Restore the exact pre-cutover DNS configuration recorded for Vercel.
3. Verify that the retained Vercel deployment is again serving `vellira.dev` and that the intended canonical-host behavior is restored.
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
