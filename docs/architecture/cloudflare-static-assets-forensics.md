# Cloudflare staging asset investigation

Historical investigation. For the subsequent option-G implementation and its
still-required release evidence, see the
[deployment/browser-cache contract](cloudflare-deployment-cache-contract.md).

Investigation baseline: PR #943, `130e5aa7a5e7d4681e264075fd1cb11117ab6516`.
Recorded 2026-09-09, before implementation changes. The intermittent manual
JS/CSS 404 remains unproven; this report does not declare the PR merge-ready.

## Confirmed facts

- [Staging run #68](https://github.com/vellira-dev/vellira/actions/runs/34390035680)
  deployed version `059c21a8-9ae2-4642-8982-d1739551c561`, build
  `130e5aa7a5e7d4681e264075fd1cb11117ab6516-34390035680-1`.
  CSS closure passed (12 files, 12 references). Wrangler uploaded 31 files and
  reused 409. Both desktop and mobile Switch-to-Checkbox browser checks passed.
  The soak then failed waiting for `main`, before clicking any component link.
  The run retained no build/browser artifacts; it did not capture an asset 404.
- `ComponentExplorer` renders its content inside divs, with an h1 supplied by
  `ComponentHeader`. Component detail pages have no main element. The earlier
  smoke waits for the sidebar and destination heading instead. A fresh staging
  GET at 18:44:12 UTC returned 200, the Switch heading, no main,
  `x-nextjs-cache: HIT`, and `cache-control: s-maxage=31536000` (CDG).
  Therefore the new soak has an invalid readiness assertion. Increasing the
  timeout cannot repair it.
- Two local OpenNext builds of the baseline used `130e5aa7-forensic-a` and
  `130e5aa7-forensic-b`, Next 16.2.11, OpenNext Cloudflare 1.20.6, Webpack,
  Node 22.22.3. Each emitted 381 static files. All copied static bytes matched.
  All shared static paths had identical bytes; only the two BUILD_ID-directory
  manifest paths changed. The Webpack runtime was `webpack-a60853e2cdf0ffad.js`.
  Its 318 mapped asynchronous chunk URLs all exist in OpenNext assets.
- The second build's server/client-reference/HTML/RSC output contained 363
  distinct JS/CSS references, and OpenNext route cache contained 38; all resolve
  after URL decoding. Route, build, and prerender manifests agree after BUILD_ID
  normalization. App-paths manifests agree structurally (key ordering differs).
  Both builds contain 31 route-cache files; 29 changed bytes across BUILD_IDs.
  All 12 client-reference manifests are structurally identical (seven differ in
  key ordering). After BUILD_ID normalization every route-cache file matches
  except `sitemap.xml.cache`, whose generated lastmod timestamp changes.
- Installed OpenNext `deploy.js` invokes `populateCache` before Wrangler.
  `populate-cache.js` copies `.open-next/cache` to
  `assets/cdn-cgi/_next_cache`. The cache adapter reads paths scoped by
  `OPEN_NEXT_BUILD_ID`. This occurs after the existing pre-deploy closure check;
  it adds route-cache assets, without rewriting JS/CSS paths.
- Installed Wrangler constructs a full normalized pathname-to-content-hash
  manifest, submits it to `assets-upload-session`, and uploads returned buckets.
  Reusing content hashes is expected. The unique anchor changes the manifest,
  but does not prove that a particular missing asset is serviceable.

## Ruled out, within the available evidence

- A captured static 404 as the reason run #68 failed: its recorded failure is an
  impossible main assertion, independently explained by source and live HTML.
- Missing copied CSS, divergent JS copies, or an absent mapped Webpack chunk in
  the two local builds. Encoded `%5Bslug%5D` paths are valid decoded file paths.
- BUILD_ID-only changes altering hashed JS/CSS in this same-source experiment.
- R2 ISR state as a configured source: neither Wrangler config binds R2; this
  app uses a read-only static-assets incremental cache. The upstream
  [R2/skew report #1183](https://github.com/opennextjs/opennextjs-cloudflare/issues/1183)
  is not evidence of the same cause here.

These do not rule out differences in the unavailable CI build, another edge
location, or the user's long-lived browser. Local builds used existing workspace
dependencies and `.env.local`; they exited successfully but emitted copy errors
for hast-util-to-html, hast-util-whitespace, and property-information. They are
asset-graph evidence, not authoritative Linux deployment validation.

## Strongest remaining hypothesis

For the manual symptom, a document/RSC/runtime from one deployment requesting
assets from another remains the leading hypothesis, not a confirmed root cause.
Long-lived browser state, a rollout during navigation, stale route output, and a
platform manifest inconsistency need to be distinguished by recording the first
bad URL and its initiator, cache headers, and deployment anchor. Staging workflow
concurrency is scoped by git ref despite sharing one Worker, so different refs
can overlap. There is no evidence here that overlap caused the reported failure.

[Cloudflare documents](https://developers.cloudflare.com/workers/static-assets/)
code and assets as one deployment unit. Differential upload is an implementation
detail, not proof of broken atomicity. No cloud-side manifest corruption has been
observed in this investigation.

## Minimum safe fix

Repair the soak's route readiness assertions using destination headings, retain
one browser document across repeated link/history navigation, and save diagnostics
on every failure: document status/final URL, same-origin HTTP errors, failed static
requests, resource types/CDP initiators, console/page errors, HTML/title, trace,
and deployment anchors. Assert asset errors before readiness timeouts obscure
them. Keep existing blocking checks and their time budgets.

Add reproducible JS/CSS reference and Webpack runtime auditing alongside existing
CSS closure, including route-cache output and byte equality of copied assets.
Retain this evidence and browser failures in CI. No production runtime/cache,
asset-prefix, dependency, domain, or deployment behavior change is justified yet.

## Validation after the test repair

- The five-round staging soak passed in 161 seconds: 70 component clicks,
  30 article clicks, 30 history returns, and one header click, with exactly one
  document response. No static failures, same-origin HTTP errors, console errors,
  or page errors were recorded. The deployment anchor stayed on run #68.
- A separate live probe fetched 343 unique URLs from the deployed Webpack
  mapping and Switch HTML, all HTTP 200, with the same anchor before and after.
  The deployed runtime filename matches both local builds.
- The unchanged static chunk smoke passed all 9 discovered blog routes and 14
  component routes, including replay validation of navigation-aborted requests.
- Running OpenNext's actual `populateCache local` added 31 assets, removed none,
  and changed no existing asset bytes. The post-population runtime audit passes.
- Runtime audit regression tests cover valid encoded/named paths, missing lazy
  chunks, corrupted copied bytes, and stale deploy-time cache references.
  Browser regressions cover a valid page without main, a wrong destination
  heading, delayed script 404/stylesheet failure, document 403/API 503,
  console/page errors, initiators, and saved HTML/trace. All four tests pass;
  both affected blog suites also pass (22 tests). Changed scripts pass ESLint
  and formatting checks.

The default soak now uses 15 rounds with a one-second dwell to cross the
observed 300-second router stale-time. Per-navigation timeouts remain 15 seconds
and the initial document timeout remains 30 seconds. `SOAK_ROUNDS` and
`SOAK_DWELL_MS` permit longer investigations without resetting browser state.

Reproduce from the repository root after building OpenNext:

```sh
node apps/website/scripts/cloudflare-build-asset-closure.mjs
node apps/website/scripts/cloudflare-build-runtime-audit.mjs
node --test apps/website/scripts/cloudflare-build-runtime-audit.test.mjs
pnpm --filter @vellira-ui/react-storybook exec node --test scripts/cloudflare-browser-diagnostics.test.mjs
WEBSITE_URL=https://vellira-website-staging.vellira.workers.dev pnpm --filter @vellira-ui/react-storybook exec node scripts/cloudflare-navigation-soak.mjs
```

Both workflows retain `cloudflare-forensics-<run_id>-<attempt>` artifacts with
the asset inventory/reference graph, Next manifests/runtime, browser JSON, HTML,
screenshot, and Playwright trace. Audits run before and after deployment; the
original CSS closure stays blocking. The original static smoke also runs after
a failed soak when deployment succeeded. A local build/probe cannot establish
what an earlier CI runner emitted or prove every Cloudflare location healthy.
