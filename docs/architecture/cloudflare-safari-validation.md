# Real Safari deployment-cache validation

Status: prepared, **not yet executed in real Safari**. The baseline
`dbcaea97e1bf037f1553b44a5772f4688dfe409f` CI/staging artifacts prove the automated
matrix, not the following Safari-specific cases. Do not turn an inconclusive
case into a pass, weaken cache settings, or replace Safari with Playwright WebKit.

## Exact open scenarios

| ID  | Missing evidence / pass condition                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Real released macOS Safari with **Block All Cookies** enabled throughout: script and HttpOnly cookies both rejected; A→B→C→A navigation and lazy assets still work. CI blocks cookies natively in Chromium/Firefox only.                                                                               |
| S2  | A quiescent Safari A document is actually restored from Page Cache after B activation: same document token and `pageshow.persisted === true`, then unused A lazy import succeeds and uncached navigation converges to B. Ordinary Back/Forward is insufficient.                                        |
| S3  | Real Safari HTTP-cached A Flight survives orderly browser quit/reopen in the same non-private profile/origin; default-fetch baseline stays stale without an origin request, actual patched transport reaches B. Merely reopening tabs or importing storageState proves neither disk cache nor bfcache. |
| S4  | Real Safari long-lived A tabs, prefetched-but-unvisited routes, expired router entries, unused lazy JS/CSS, and retained graphs across A→B→C→A, including after S2. Playwright WebKit passes this fixture but is not the released Safari/browser-profile integration.                                  |
| S5  | Rapid document unload while a real segment-prefetch is still in flight: no uncaught prefetch/access-control error or broken restored navigation/assets. A prior Linux WebKit run reported an access-control error; the current quiescent bfcache case does not close that race.                        |
| F1  | Firefox actual bfcache restoration remains unobserved in the baseline. Safari success cannot close this separate engine gap.                                                                                                                                                                           |

These cases do not prove an iOS/iPadOS Safari device. Record that as untested unless
a real-device run is separately required and performed. Two staging successes do
not replace S1–S5 or prove a live Cloudflare A/B/C/rollback sequence.

## Setup: reuse the existing controlled origin

Use a disposable **non-private** Safari profile (or test macOS account), not a
personal browsing session. Record macOS version, Safari full version/build,
hardware, profile name, commit SHA and dirty/clean status, time zone, and settings.
Do not run `safaridriver` for the primary persistent-cache proof: use real Safari's
normal profile. Safari Technology Preview can be supplementary, not a substitute.

From a clean checkout of the final review commit, use the pinned toolchain and
frozen lockfile (Node 22.22.0 in CI):

```sh
pnpm install --frozen-lockfile
node apps/website/scripts/cloudflare-migration-manual.mjs
```

The runner builds materially distinct A/B/C using the existing fixture and checks
the actual shipped Next transport. It prints one `http://127.0.0.1:<port>` origin
and a fresh evidence directory. Keep this process alive through browser quit and
reopen: restarting changes the origin/port and invalidates that comparison.
No remote Cloudflare binding, account credentials, deployment or production write
is used. Its local R2 archive is populated before every generation switch.
HTTP localhost proof is separate from HTTPS Cloudflare deployment evidence.

Terminal commands (one at a time; wait for acknowledgement):

```text
status
poison on
poison off
A
B
C
check
save
quit
```

`A/B/C` use the existing `origin.activate()` path, never direct state mutation.
`check` verifies HTTP 200, exact SHA-256, MIME and immutable caching for the full
union of activated graphs. `save` snapshots origin requests, state, command times,
inventories and source HEAD in `manual-evidence.json`. No command disables archive
verification. `poison on` is solely the pre-existing legacy-cache fixture switch;
leave it off outside the explicit poisoning steps. Unknown commands fail closed.
The runner never declares Safari passed: the operator must attach results below.

Enable developer features using Safari Settings → Advanced. Set **Block All
Cookies** before opening the test origin; record a screenshot. Settings placement
can vary with Safari version. Do not clear browsing data during a sequence.
Web Inspector Network: **Ignore Cache off**, Preserve Log on; no request routing,
service worker, cache disabling or URL query modification. Export HAR and console
logs. Because Inspector can change timing/cache eligibility, repeat S2/S5 with it
closed during traversal; collect in-page evidence afterward. See
[Apple settings](https://support.apple.com/en-ie/guide/safari/ibrw1075/mac) and
[WebKit Network controls](https://webkit.org/web-inspector/network-tab/).

## S1: native cookie blocking and initial A state

Open the printed origin in three tabs, named main, old-A and late-A. All must show
`Generation A` / `Client A`. Do not click either lazy button in late-A.
In main's Console, run:

```js
document.cookie = 'vellira_script_probe=1; Path=/';
await fetch('/api/cookie-probe');
({
  script: document.cookie,
  server: await (await fetch('/api/cookie-probe')).text(),
});
```

Both strings must be empty. Preserve the response Set-Cookie plus the subsequent
request with no Cookie, including server evidence (`save`). Record the preference
as well: an empty cookie jar alone is not proof of native blocking. Leave blocking
enabled through S2–S5; do not relax it to make a cache/bfcache case pass. If Safari
does not retain cache with this policy, report the specific case inconclusive and
run a separate, clearly labelled cookies-allowed diagnostic if needed.

## S3 first half: real HTTP poison and request-side bypass

1. In terminal: `poison on`. In main Console:
   `await window.__migrationTransport('/target/fresh')`.
   This calls the actual patched bundled transport. In terminal: `save`.
2. Copy the **exact** last `/target/fresh` RSC request URL from
   `manual-evidence.json.originRequests` into `window.poisonedUrl` in the Console.
   Do not construct/change `_rsc`, add a version query, or assume a fixed checksum.
   Define the unpatched baseline, not a global fetch override:

   ```js
   window.plainFlight = async () => {
     const response = await fetch(window.poisonedUrl, {
       headers: { RSC: '1' },
     });
     return {
       body: await response.text(),
       headers: Object.fromEntries(response.headers),
     };
   };
   window.seed = await window.plainFlight();
   ```

3. `save`, call `plainFlight()` again, then `save`. Both bodies must contain
   `migration-A`; the second must produce **no additional origin request for that
   exact URL**. The first baseline call after the no-store transport must have
   reached the origin, proving that patched call did not seed HTTP cache itself.
   Count matching URLs in snapshots, not all requests (background prefetch runs).
   Keep the original URL and seed outside browser memory for the restart case.
4. Terminal `poison off`, then `B`. Default `plainFlight()` must still return the
   A body without an origin request. `await window.__migrationTransport('/target/fresh')`
   must now return `migration-B`, B identity/no-store headers, with a new B origin
   request. Cached response IDs or `cf-ray` alone do not prove server execution.

## S4: prefetch, old tabs, expiry and rollback

Before switching A to B above, use a separate A tab for same-build prefetch proof:
hover Prefetched, wait for its completed RSC request, record matching origin count,
then click within 30 seconds. Expect `Target prefetched A` and no extra RSC for that
route. Keep old-A prefetched but unvisited until B. Background prefetch timing and
any delay must be recorded; expired prefetch is not a valid reuse test.

At B: click Prefetched in old-A, then Load lazy. A or B content is allowed, with no
asset error. Main Fresh must converge to B, with native document fallback allowed.
Terminal `check`. Main Home → wait at least 31.5 seconds (fixture stale-time clamp)
→ Expired must produce new RSC and B content. This does not replace the real site's
longer router-cache soak, which runs in staging.

Terminal `C`: in **unreloaded late-A**, click Load later lazy for the first time.
Require `Later lazy A: first requested after C` and `Client A`. Main Fresh must
converge to C; repeat Home/31.5s/Expired and `check`. Then terminal `A` (fixture
rollback), repeat Fresh/expiry/`check`; B/C assets must still be available. Preserve
all old tabs and the same profile throughout. Record CSS appearance/computed values
and first-use lazy network URLs, not only BUILD_ID changes.

## S2: actual Safari Page Cache restoration

With A active, open a new A tab and install this observation-only snippet:

```js
window.safariProbe = { token: crypto.randomUUID(), shows: [], errors: [] };
addEventListener('pageshow', (e) =>
  safariProbe.shows.push({ at: Date.now(), persisted: e.persisted })
);
addEventListener('error', (e) =>
  safariProbe.errors.push({ at: Date.now(), message: e.message })
);
addEventListener('unhandledrejection', (e) =>
  safariProbe.errors.push({ at: Date.now(), reason: String(e.reason) })
);
JSON.stringify(window.safariProbe);
```

Record the token, wait for actual request quiescence, close Inspector, navigate to
`/outside` via the address bar (a document navigation, not router navigation).
Terminal `B`, then Safari Back. Reopen Inspector only after restoration. Require
the same `safariProbe.token` and a `shows` entry with `persisted: true`; otherwise
S2 is **not proven**, even if the page works. Click unused Load lazy and then Fresh:
require successful old asset load, convergence to B, no recorded error, and `check`.
Repeat after C and rollback to A. Do not add unload handlers to collect evidence:
[WebKit documents pageshow.persisted for Page Cache](https://webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/).

## S3 second half: orderly Safari quit/reopen

After the long-lived-tab sequence (quitting would end that case), terminal `A`,
`poison on`, seed the same exact URL using default fetch and confirm a real hit
with no second origin request. Record it outside the browser; `save`. Quit Safari
normally without deleting data; keep the terminal origin alive. Terminal
`poison off`, `B`; reopen Safari in the **same non-private profile** and same origin.
Recreate only the Console helper/URL, not the cached response. Default fetch must
still yield A without an origin request; bundled transport must yield B with a
new origin request. If Safari evicted the entry, report disk-cache persistence as
inconclusive, not as successful stale-cache bypass. Browser restoration after quit
is not evidence for S2's in-process Page Cache restoration.

## S5: rapid unload with a genuinely in-flight prefetch

Use a fresh A document/route not already prefetched in this profile, with the
same observation snippet installed. Start native prefetch (hover Prefetched or
Expired), immediately navigate to `/outside`, switch to B, Back, exercise lazy
and Fresh. Repeat at least 20 times, with timestamps and unfiltered errors.
HAR must show at least one prefetch started before navigation and completed or
failed after it; otherwise this race was not exercised. Retest with Inspector
closed. Do not enable Ignore Cache or Playwright interception to induce the race.
If local responses are too fast, record inconclusive and use a separately recorded
OS network-delay profile for localhost; record settings and restore them afterward.
Do not count a canceled transport as an uncaught application error, but do not
silently ignore access-control/page errors either: retain request, navigation,
error and restoration timelines so the distinction can be reviewed.

## Evidence and verdict

At each milestone `save`; after each activation `check`; end with `quit` to flush
evidence and stop local servers. Keep source/generated fixtures until evidence is
reviewed. Attach settings/version screenshots, HARs, console output, document
tokens/pageshow records, exact poison URL and before/after matching origin counts,
asset-closure outputs and per-case pass/fail/inconclusive verdicts. Redact unrelated
personal data; do not use this fixture to browse authenticated personal content.

Run S1–S5 in real Safari before changing their status in the PR. The manual runner's
successful build/closure checks are infrastructure proof only, never a Safari pass.
