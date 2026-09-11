# Website deployment and browser-cache contract

Implementation baseline: PR #943, starting HEAD
`438dbfb496cdd9c9e9c388c33d6b980304f7426e` (Next 16.3.3, OpenNext Cloudflare
1.20.6). This document defines option G. It is not a declaration that the PR is
ready: exact-final-HEAD CI, live staging, and the evidence below remain mandatory.

Validated checkpoint: `dbcaea97e1bf037f1553b44a5772f4688dfe409f` has complete
successful CI and staging evidence. See the [review record](cloudflare-pr943-review.md)
for exact run IDs, required-check status and remaining gates; this does not carry
that result forward to later commits. Operator commands are in the
[runbook](../../apps/website/CLOUDFLARE_MIGRATION.md).

During implementation, #943 advanced to `1fdea12c9dd41e51d872bd55aed941791a2a739a`
by merging main. The option-G changes were carried onto that head without
overwriting its token-factory, React, or lockfile updates. Earlier local results
on the original base are exploratory, not exact-final-head release evidence.

The branch subsequently advanced to `915587816e5eb8fdbd9bd5aee77ccbfb4e71a0ec`
through further main merges (token ownership, testing-library and release changes).
Those changes must be preserved; results on `1fdea12c` are also exploratory until
revalidated on the final implementation commit.

## Failure class and limits of the original evidence

Build-specific Flight data, router/segment entries, loaded documents, and
bfcache entries can survive activation of another deployment. Their original
immutable asset graph must remain available. The original incident has not been
attributed conclusively to browser HTTP cache, router memory, bfcache, shared
HTTP cache, or a combination. The older
[forensic report](cloudflare-static-assets-forensics.md) is historical evidence,
not proof of one original cache source.

The controlled regression separately demonstrates a real browser HTTP-cache
failure: default fetch can return A Flight after B activates, without any origin
request. Response-side no-store cannot affect that response. This reproduction
must not be presented as proof that the original incident had the same cause.

## Architecture

| Layer                    | Contract                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next transport           | Pinned pnpm patch adds only `cache: 'no-store'` to `createFetch`'s shared options, in distributed CJS and ESM. Initial and redirect-replay calls share it. No global fetch interception or `_rsc` changes.     |
| Router memory            | Native Next prefetch/segment caching stays enabled. A valid prefetched click must not redundantly fetch Flight. Native build-mismatch document fallback remains intact.                                        |
| Flight responses         | Worker applies `private, no-cache, no-store, max-age=0, must-revalidate` to actual RSC request markers or `text/x-component` responses, including redirects/errors/actions. Response streams are not buffered. |
| HTML                     | Browser must revalidate: `no-cache, max-age=0, must-revalidate`. Both CDN cache-control headers are `no-store`. Shared route HTML is not cached; no deploy-time HTML purge is needed under this configuration. |
| OpenNext route cache     | Read-only static-assets incremental cache remains deployment-scoped; it is not the immutable archive and is not R2 ISR. No experimental skew routing or `deploymentId` dependency.                             |
| Current immutable assets | Workers Assets serves exact current URLs, with the narrowly scoped `public/_headers` immutable policy.                                                                                                         |
| Old immutable assets     | Asset misses reach the Worker, which serves exact original URLs from an append-only R2 archive. No URL rewrites, old RSC archive, or old server-version routing.                                               |
| APIs/public resources    | Keep their own cache semantics. No blanket no-store, cache clearing, migration cookies, or document redirects.                                                                                                 |

Next 16.3.3 constructs its `_rsc` identity from routing headers, not BUILD_ID.
Changing the URL at the Worker would happen too late to bypass a browser cache
hit. The installed `router-reducer/fetch-server-response` transport and
`segment-cache/cache` call path are checked; the HEAD request used by static
`output: export` is outside this server deployment. The application does not use
static export. `deploymentId` and version-affinity routing are future options,
not substitutes for retaining the immutable graph of an already-loaded client.

### Patch lifecycle

`patches/next@16.3.3.patch` contains two single-line changes. Workspace and lockfile
register it explicitly; unused patches are forbidden. `check:next-rsc-patch`
checks the actual resolved package version, exact website pin, both transport
variants, and both shared-options fetch calls. The production check parses the
bootstrap chunks named by `.next/build-manifest.json`, failing if the patched
transport is absent or cacheable. A Next upgrade must review this contract;
removing or orphaning the patch is not an acceptable upgrade path.

Tests execute the installed transport with its original cache-key helper to
check credentials, headers, signal, priority, redirect replay and cancellation.
The browser fixture calls the actual bundled transport, not a replacement
implementation. The patch changes HTTP caching, not Next's decoded memory cache.
It does not purge existing disk entries or repair an already-loaded old client.
That is why immutable asset retention is also required.

Keep this as a temporary, exact-version patch while proposing a scoped upstream
request-cache policy. Do not grow it into a private Flight protocol. Source maps
remain upstream maps; framework stack-line mapping can be offset by the inserted
line. A supported upstream fix should replace the patch only after the same
regression matrix passes.

### Asset routing is significant

An explicit negative `run_worker_first` pattern routes a match to the assets
service, even if the asset is absent. Therefore `!/_next/static/*` cannot be used
for archive fallback. Leave static paths on default asset-first/miss-to-Worker
routing. Only APIs and runtime diagnostics are explicitly Worker-first. Disable
asset HTML/404 rewriting. Deployment rejects direct `.html` assets, which could
otherwise bypass the document freshness policy. New direct HTML requirements
need an explicit routing/freshness review.

The local Workers-runtime regression uses the actual assets router and R2, not
an ASSETS mock. It verifies current-file fast-path handling, an archived miss,
an absent miss, matching MIME/cache headers, and document policy.
Every allowed archive MIME mapping is compared with the installed Workers Assets
runtime, not just JS. Target config tests exercise Wrangler's actual JSONC parser
and reject mixed staging/production buckets and miss-bypassing asset routing.

## Deployment ordering and identity

The supported entrypoint is `apps/website/scripts/cloudflare-deploy.mjs` (also
the website's `deploy:opennext` script). Deployment workflows retain their
existing staging/production boundaries. Production remains a manually confirmed,
main-only isolated candidate: this change attaches no public domain.

Before step 1, both deployment workflows run `cloudflare-archive-preflight.mjs`
immediately after dependency installation. It requires an explicit
`CLOUDFLARE_ACCOUNT_ID`, validates the target origin/config, reads a cache-busted
active `/BUILD_ID` with a timeout and no redirects, opens the same remote R2
binding used by the uploader, and calls the existing `requireArchivedDeployment`
to verify the predecessor's complete bytes and metadata. It emits account,
Worker, bucket and predecessor identity diagnostics, but never writes archive
objects or activates traffic. Missing R2, denied access, missing manifests and
incomplete/corrupt graphs stop before website builds or browser tests. This is
not a cached authorization to deploy: the activation-time gate below still
re-reads and verifies the active predecessor.

1. Build with `VELLIRA_BUILD_ID=<full Git SHA>-<GitHub run ID>-<run attempt>`.
   A deployable build without this explicit identity fails. When GitHub identity
   variables are present, each part must agree. Local Next builds get a unique
   `local-...` identity, which cannot pass the deployment gate.
2. Run the original CSS closure, runtime graph audit, cache contracts and real
   browser migration regression. Gates are additive, not replacements for the
   original blog/navigation/static-chunk tests.
3. Populate OpenNext's local static route-cache assets, before the final audit.
4. Verify `.next/BUILD_ID`, OpenNext's BUILD_ID asset, compiled server/middleware
   identity, deployment cache namespace and populated asset namespace, browser
   transport, copied static bytes and full runtime asset closure.
5. Require and verify the active predecessor's archive manifest. Then archive
   every current `/_next/static/...` asset and verify stored bytes and
   metadata. Record its append-only deployment manifest. Failure or collision
   stops before activation.
6. Write archive evidence and the generated build seal imported by the Worker.
   A fresh/unprepared build cannot bundle that entrypoint. A failed preparation
   deletes an earlier seal. The seal is a generated artifact, not migration state.
7. Wrangler dry-run, then activation, then runtime identity/header/byte checks
   and all original browser/metrics/static-asset smoke tests.

The workflow concurrency groups are keyed by actual target Worker:
`deploy-worker-vellira-website-staging` and `deploy-worker-vellira-website`.
Cancellation of an active deployment is disabled. Different refs targeting the
same Worker serialize. Manual CLI/dashboard deployments and older workflow
revisions outside those groups are not magically serialized: prohibit them
during rollout and use this entrypoint for supported deployments.

### Archive guarantees and onboarding

Staging and production use separate `STATIC_ASSET_ARCHIVE` buckets. Keys are
`assets/_next/static/<original decoded path>`. URL decoding is validated against
malformed encodings, traversal and control characters. Encoded `[slug]` paths
retain their original public URLs. No unrelated API/public path reaches R2.

Writes are atomic create-only (`etagDoesNotMatch: '*'`). Every upload verifies
the actual stored SHA-256, size, MIME and immutable policy, including pre-existing
objects; digest metadata alone is insufficient. Different bytes at an existing
key stop deployment and never overwrite the old bytes. Downloads stream from R2;
HEAD and conditional ETag requests work. Range requests may receive a valid full
200 response. Missing objects are non-cacheable 404s, not cached immutable errors.

Retention is append-only. There is no last-N-deployments cleanup, TTL, lifecycle
expiration, or invented old-client support window. Monitor bucket growth and
cost. Introducing deletion requires an explicit supported-client window and a
separate proof. Storage retention is not old server-version retention: old
clients still reach the current server, and must use stable API contracts or
native mismatch fallback. Indefinite old server-action compatibility is not
implied by retaining JS/CSS.

Before first production activation, backfill every available supported historical
asset graph, including the currently active deployment, from trustworthy build
artifacts. Use the same create-only/hash/MIME verification. Already-deleted assets
cannot be reconstructed from BUILD_ID or a cached Flight response. If historical
artifacts are unavailable, an unlimited pre-adoption old-client guarantee is
unproven and production cutover must not be declared safe. This is separate from
protecting all deployments archived under this new contract.

The deployment gate reads the target's current `/BUILD_ID` and refuses activation
if its verified archive manifest is missing. Backfill from an original artifact:

```sh
node apps/website/scripts/cloudflare-archive-backfill.mjs \
  apps/website/wrangler.jsonc /path/to/original/.open-next/assets EXPECTED_BUILD_ID
```

This command verifies the supplied artifact's BUILD_ID and stores only immutable
assets and an archive manifest. It never activates traffic. An unknown active
identity is a blocker, not permission to skip predecessor retention.

To check prerequisites without building or deploying, set `WEBSITE_URL` and
`CLOUDFLARE_ACCOUNT_ID` (plus the CI API token when not using Wrangler OAuth):

```sh
node apps/website/scripts/cloudflare-archive-preflight.mjs wrangler.jsonc
```

Cloudflare control-plane R2 errors and remote-binding errors can differ: for
example, the 2026-09-10 staging investigation saw control-plane `10042` (enable
R2) and preview-binding `10085` (bucket not found) for the same account. A Worker
deployment permission is not proof of available R2 storage. Provisioning and
initial backfill remain explicit operations; preflight never creates a bucket
or accepts a missing predecessor. The checks must run under the deployment's
actual CI credentials; local OAuth access alone does not establish CI access.

The archive client hosts Wrangler's remote proxy server in a separate Node
worker thread. Miniflare's synchronous binding-property RPC can block the calling
event loop in `Atomics.wait`; hosting the HTTP proxy in that same loop caused a
real remote-R2 deadlock during onboarding. The separate loop keeps the proxy
responsive. Startup/disposal are bounded, the session URL stays in memory, and
both Miniflare and the remote session are disposed. Archive algorithms, atomic
create-only writes and complete read-back verification are unchanged. This uses
the pinned Wrangler/Miniflare APIs, not a deployed public uploader Worker or an
alternative unverified storage path.

Build-time read-back consumes `R2ObjectBody.arrayBuffer()` within the RPC method
before computing SHA-256, rather than iterating a remote-proxied body stream from
Node across request contexts. Only this offline verifier buffers bodies (uploads
already buffer each asset); deployed Worker responses continue to stream. Size,
digest metadata, MIME and immutable cache policy are still checked independently.

Rollback must retain this archive/freshness/transport architecture. Rolling back
to a pre-contract Worker would restore the old failure mode (or cookie redirect).
Use an earlier validated option-G deployment, or rebuild old application source
with the current deployment contract and a fresh run identity. Never delete
newer-generation assets during rollback.

## Expected A → B behavior

For an updated client, a transport request bypasses an HTTP-cached A Flight entry
and reaches B. B's response cannot create a new browser/shared HTTP entry. A
valid A router prefetch or restored A document may still be used: its original
immutable assets remain available, including lazy chunks first requested after B
or C. On an uncached request, native build mismatch can replace the document with
B automatically. No cookie, cache-wide clearing, manual recovery, or URL rewrite
is involved. Repeat the same contract at C and rollback.

No finite server-side policy can alter an offline or never-contacting already
loaded client. The guarantee concerns continued supported online use; it does
not promise live content updates without interaction or arbitrary old API/server
action compatibility.

## Evidence and remaining release gates

### Runtime asset MIME verification

The live wire contract accepts `text/javascript` for `.js` and `text/css` for
`.css`, either without parameters or with one `charset=utf-8` parameter (including
the quoted value and case-insensitive MIME tokens). This applies only when the
archive inventory declares the corresponding UTF-8 type and the exact body is
valid UTF-8. Unknown, duplicate, malformed and non-UTF-8 parameters fail closed.
Other types retain exact header matching; this is not a global MIME normalization.
Status 200, SHA-256, immutable caching, full graph coverage and deployment identity
remain independent required assertions. Archive metadata and objects are unchanged.

This allowance follows actual staging evidence after run `34517438239`: 344 JS
and 9 CSS resources served by Workers Assets omitted charset; 19 JS and 3 CSS
archive fallbacks retained it. All 381 resources matched their original bytes and
immutable policy; all six WOFF2 headers matched exactly. The generated CSS has no
leading encoding declaration. Missing charset alone must not fail this verifier,
but a matching header must never excuse corrupted bytes.

`test:cloudflare-cache` covers installed transport execution, identities, streamed
response policy, real R2 conditional/collision behavior and actual asset routing.
`test:cloudflare-migration` builds materially different Next A/B/C graphs, switches
a real HTTP origin without Playwright request interception, and keeps the same
persistent profile/tabs through A→B→C→rollback and browser close/reopen. It records
network initiators, cache/source events, response headers and corresponding origin
requests. It proves cache poisoning separately from deployment transition behavior.

Chromium uses the full headless browser, not headless-shell, and explicitly enables
bfcache; it must observe `pageshow.persisted`. Cookie blocking uses native Chromium
preferences and Firefox cookie policy, verified with both script and HttpOnly
cookie probes. WebKit runs the HTTP-cache/profile/navigation matrix, but Playwright
does not expose its global cookie-accept policy. WebKit/Safari bfcache and Safari's
real Block All Cookies setting require separately recorded real-Safari evidence
if not observed in CI. A normal back/forward traversal is not bfcache proof.
The [real-Safari checklist](cloudflare-safari-validation.md) enumerates the exact
unclosed scenarios and provides a terminal-controlled runner using this same
fixture/origin. Preparing that test is not a Safari pass.

The dedicated bfcache case first waits for network quiescence, without routing
interception. A Linux WebKit run completed the cache/asset transition assertions
but reported a prefetch access-control error while its document was immediately
unloaded. Do not silently filter this error: request/failure/navigation timestamps
are recorded, the zero-pageerror assertion remains, and rapid unload with in-flight
prefetch remains an additional cancellation/Safari investigation, not proven fixed
by the archive. The CI browser container uses Playwright's recommended UID 1001;
Firefox refuses root execution with the runner-owned home directory.

Diagnostics distinguish CDP `fromDiskCache`, `requestServedFromCache`,
`fromServiceWorker`, initiating requests, first bad asset and generation headers.
Non-Chromium reports do not invent unavailable CDP fields. A cached `cf-ray` or
`X-Vellira-Request-Id` is not evidence of a new Worker execution: correlate with
origin/Worker logs. The runtime endpoint performs uncached independent identity
checks. Credential headers are omitted from the diagnostic JSON.

Release evidence must record starting/final HEAD, clean-worktree provenance,
frozen installation, production build/patch proof, identity/namespace closure,
archive evidence, all browser profiles/transitions, metrics regressions, exact-head
full CI and live staging. The controlled origin is not a live Cloudflare rollout.
Do not substitute a prior green staging run or a local fixture for those gates.

`cloudflare-local-runtime.mjs` additionally runs the actual generated OpenNext
bundle under local Wrangler before remote archive/activation. Its temporary test
entry does not create a deployment seal. It checks HTML and real prefetch Flight
for homepage, blog, article and component routes. The diagnostic Flight probe
uses the installed Next URL builder, not a custom checksum or protocol change.
A synthetic request with only `RSC: 1` encountered an empty-checksum redirect loop
through this OpenNext runtime; real prefetch headers and their Next-generated URL
passed. This is distinct from the removed migration redirect and remains a
documented adapter edge case, not justification to disable Next header validation.

OpenNext emitted copy errors for `hast-util-to-html`, `hast-util-whitespace` and
`property-information` while exiting successfully. Local generated-runtime route
tests passed, including a blog article. That does not replace the full live
navigation/MDX smoke or prove every dynamic code path unaffected.

The initial R2 10042/10085 onboarding blocker was resolved for staging on
2026-09-10: the Standard archive bucket was provisioned, original active assets
were provenance-checked/backfilled, and CI credentials passed predecessor and
current archive verification through the complete `dbcaea97…` staging run.
This is not proof of production bucket provisioning or historical asset coverage
before that archived predecessor. Keep #943 Draft; no production cutover or merge.

Sources: [Workers routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[asset headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
