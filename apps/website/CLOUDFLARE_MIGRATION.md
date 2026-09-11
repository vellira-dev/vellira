# Cloudflare website migration

This document is the operational runbook for moving `vellira.dev` from Vercel to Cloudflare Workers.

The [deployment/cache contract](../../docs/architecture/cloudflare-deployment-cache-contract.md)
defines the existing architecture. The [PR #943 review record](../../docs/architecture/cloudflare-pr943-review.md)
pins the successful `dbcaea97…` baseline and distinguishes it from later exact-head validation.
Real-Safari gaps and reproduction are in the [Safari checklist](../../docs/architecture/cloudflare-safari-validation.md).
These documents do not authorize production activation or domain cutover.

## Adapter and worker topology

The active Cloudflare adapter is **OpenNext** (`@opennextjs/cloudflare`). Vinext was used only during the initial compatibility experiment and is not part of the active build or deploy path.

Two Workers are intentionally separated:

- Staging: `vellira-website-staging` → `https://vellira-website-staging.vellira.workers.dev`
- Production: `vellira-website` → initially available only through its `workers.dev` hostname

Do not attach `vellira.dev` to the staging Worker. Automatic staging pushes use `feat/website-cloudflare-staging`; manual workflow dispatch can select another reviewed ref, including PR #943. Sharing that Worker with production would allow a staging deployment to change the public site.

The production Wrangler configuration intentionally contains no custom-domain route before cutover. Adding the domain is a separate, explicit production operation.

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

Do not switch the public hostname until all of the following are true:

1. The latest staging deployment is green on a clean dependency graph with OpenNext as the only Cloudflare adapter.
2. The browser smoke suite is green, including blog metrics/CORS and mobile navigation.
3. No intermittent Worker 5xx/limit outcome is reproducible.
4. The exact final commit has **two consecutive complete green staging validations**, with distinct SHA/run/attempt build identities, the second verifying the first as its archived predecessor, and no reproducible Worker 5xx/limit regression. Changes after either validation reset this requirement.
5. The production Worker `vellira-website` has been built from the intended `main` revision and verified on its `workers.dev` hostname before receiving the public domain.
6. The current Vercel production deployment remains intact and its DNS state is recorded for rollback.
7. The previous Cloudflare production Worker version ID, when one exists, is recorded before any replacement deploy.

## Supported deployment entry and staging procedure

Use the repository workflow. It installs frozen dependencies, checks remote R2
and the live predecessor before building, builds with
`VELLIRA_BUILD_ID=<full SHA>-<run ID>-<run attempt>`, and runs all preactivation tests.
Do not fabricate GitHub identity variables for a local production deployment.

From the repository root, after confirming the intended PR HEAD:

```sh
gh pr view 943 --repo vellira-dev/vellira --json headRefOid,isDraft
gh workflow run deploy-website-cloudflare-staging.yml \
  --repo vellira-dev/vellira --ref fix/cloudflare-blog-metrics-contract
```

Record the run ID and verify its `headSha` equals the intended final commit.
Wait for the entire workflow to succeed, including metrics, soak and static-chunk
smoke, before dispatching the second run on the unchanged ref. Confirm no other
deployment intervened and the second run's `archive-evidence.json.previousBuildId`
equals the first run's build ID. Preserve both forensic artifacts before expiry.
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
and the new seal; run Wrangler dry-run; run Wrangler activation. No OpenNext
mutation follows the archive gate. Postactivation checks belong to the workflow.

Do **not** invoke upstream `opennextjs-cloudflare deploy`, direct `wrangler deploy`,
or reuse a generated seal to bypass this contract. A seal is a build-time guard,
not an account permission boundary. Missing archive access, a missing predecessor
manifest, collision or unavailable original artifact is a blocker: never skip
`requireArchivedDeployment`, replace historical bytes with a rebuild, or rewrite
R2 metadata merely to align Content-Type strings. See the archive-only backfill
procedure in the deployment/cache contract.

## Production candidate deployment (separate approval required)

Build and deploy the production candidate with `apps/website/wrangler.production.jsonc` so it cannot overwrite the staging Worker.

Only the existing `Deploy Website Cloudflare Production Candidate` workflow is
supported: it requires `main` and explicit `DEPLOY_CANDIDATE` confirmation. Its
activation step calls `node apps/website/scripts/cloudflare-deploy.mjs
wrangler.production.jsonc`, after the same build, archive and browser gates.
This review does not run that workflow. A missing production predecessor/archive
requires explicit provenance-backed onboarding before any activation.

Before cutover, this production config must not contain a `routes` entry for `vellira.dev`.

Verify the candidate through its `workers.dev` hostname with the same important public routes. Metrics/CORS must be validated again after the custom domain is attached because the browser Origin changes to `https://vellira.dev`.

## Cutover sequence

1. Confirm the exact `main` revision intended for production and that the matching staging validation is green.
2. Deploy that revision to the separate `vellira-website` Worker without a custom-domain route and smoke-test the candidate.
3. Record the current Vercel DNS records/targets and keep the Vercel project deployed.
4. In Cloudflare Workers, attach the **apex `vellira.dev`** hostname to `vellira-website` as a Custom Domain. Resolve any conflicting existing DNS record only at this step. Do not attach the domain to `vellira-website-staging`.
5. A future cutover change must update the production Wrangler source of truth
   **and** explicitly review the currently workers.dev-only target validation,
   origin checks and workflow safety gates. The current guarded entry rejects
   public-domain routes; adding the following fragment alone is not a supported
   deploy procedure or permission to weaken those guards:

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

If a separately authorized future rollback is needed, select only an earlier
validated deployment retaining the request/response cache policy, HTML freshness
and append-only asset fallback. A pre-contract Worker is not a safe rollback.
Retain newer asset graphs too. The present guarded build/deploy entry does not
implement a version-rollback command; do not present a dashboard/direct CLI
rollback as a validation-equivalent path. Coordinate it separately and preserve
identity, predecessor/archive and target-serialization evidence.

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
