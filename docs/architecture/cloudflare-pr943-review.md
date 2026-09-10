# PR #943 review and evidence ledger

## Validated baseline (immutable historical record)

`dbcaea97e1bf037f1553b44a5772f4688dfe409f`, based on the main-updated
`1d7aa3e9a32ca6d579fe687dec5b62e88013ab30`, is the MIME-fix version with:

- [Full CI 34522686054](https://github.com/vellira-dev/vellira/actions/runs/34522686054):
  Build, Test & Validate and Cloudflare cache/multi-deployment browser contracts passed.
- [Complete staging 34522707325, attempt 1](https://github.com/vellira-dev/vellira/actions/runs/34522707325):
  all steps passed, none skipped. Job `103023893964`; forensic artifact
  `10171428645` (`cloudflare-forensics-34522707325-1`).
- Activated BUILD_ID: `dbcaea97e1bf037f1553b44a5772f4688dfe409f-34522707325-1`;
  Worker version `b0966f0b-f4df-4739-ba6d-db508920616c`.
- Verified predecessor: `3a4c9b899b45885206a568bb2d2019b2610a79cb-34517438239-1`.
- Runtime contract: 381 exact assets (363 JS, 12 CSS, 6 WOFF2), build identity,
  HTML/RSC freshness, status, SHA-256, explicit MIME policy and immutable caching.
- Aggregate same-origin metrics, actor continuity, repeated same-day view/like
  no-ops, metrics-outage behavior and navigation/static smoke passed.
- Soak: `20:09:28–20:18:18 UTC` on 2026-09-10, 8m50s, 15 rounds each of
  14 component routes and six articles, 312 RSC responses with no-store;
  diagnostics report no errors or static failures.
- CI and staging fixture matrices passed Chromium/Firefox/WebKit with the
  limitations below. Lighthouse, Chromatic and CodeQL also passed.

This pins a proven baseline, not the final review commit. Any later source or
documentation commit needs fresh exact-head evidence. Do not relabel these runs
as verification of a descendant commit or as two consecutive staging successes.

## Scope and guarded entry review

The [deployment contract](cloudflare-deployment-cache-contract.md) remains option G.
No RSC protocol/patch changes, skew routing, deploymentId dependency, cookie/CSD
migration, storage rewrite or activation-order changes are part of this review.
The original incident's specific cache source remains partially unproven; the
confirmed failure class is surviving build-specific client/RSC state without a
guaranteed original immutable asset graph.

The [operational runbook](../../apps/website/CLOUDFLARE_MIGRATION.md) is aligned
with `cloudflare-deploy.mjs`, not upstream OpenNext deploy. The workflow owns
preflight/build/browser gates and postactivation smoke. The guarded entry owns
final route-cache population, identity/closure checks, predecessor and current
archive verification, seal, dry-run and activation in that order. Its seal is
not protection against an account administrator deploying outside the workflow.
Direct/dashboard deployments are not serialized by GitHub's concurrency group.

R2 onboarding is proven for staging only. Original resources for build
`51528508febfe16ca1f7c49b2e9be6bde4e7f6cb-34408020903-1` were recovered from the
then-active origin and verified against its original CI SHA-256 inventory, not
rebuilt. Broader pre-adoption historical closure and production readiness are
not implied. Old assets and old server versions remain separate guarantees.

## Required checks: read-only audit on 2026-09-10

The classic branch-protection endpoint returned `404 Branch not protected`;
that did **not** mean rules were absent. The effective rules for `main` and
[active Protect Main ruleset 17806466](https://github.com/vellira-dev/vellira/rules/17806466)
require these check contexts:

| Context                | Integration ID |
| ---------------------- | -------------- |
| Build, Test & Validate | 15368          |
| chromatic              | 15368          |
| Validate PR title      | 15368          |
| CodeQL                 | 57789          |

`Vercel` is not in that effective list; `gh pr checks 943 --required` agrees.
The baseline Vercel status was failed due to deployment rate limiting, not a
required merge gate. No check was disabled, marked successful, rerouted, or
removed; no rule or integration was changed. Required up-to-date checks and
review-thread resolution remain enforced. Cloudflare CI/staging/Safari gates
are acceptance requirements even where not encoded as required GitHub contexts.

Recheck immediately before any future readiness decision (rules can change):

```sh
gh api repos/vellira-dev/vellira/rules/branches/main
gh api 'repos/vellira-dev/vellira/rulesets?includes_parents=true'
gh api repos/vellira-dev/vellira/branches/main/protection
gh pr checks 943 --repo vellira-dev/vellira --required
```

Preserve the 404 separately and continue to the ruleset query; do not interpret
an authorization error or unavailable API as proof that a check is optional.

## Still-open evidence

The exact [Safari/bfcache checklist](cloudflare-safari-validation.md) is unexecuted
in real Safari. Firefox and Playwright WebKit did not observe bfcache restoration;
only Chromium recorded `pageshow.persisted=true`. Native Safari cookie blocking,
disk-cache persistence, old tabs/restores, and rapid unload during in-flight
prefetch need separate evidence. A WebKit engine pass is not a Safari pass.

The controlled A/B/C origin is not three live Cloudflare deployments and rollback.
Two successful staging runs on one commit prove repeatability and predecessor
continuity, not materially distinct live A/B/C graphs or live rollback behavior.
No live rollback or production candidate is authorized in this review.

Known adapter/runtime warnings (copy warnings and remote-proxy cancellation
diagnostics) must remain visible. Successful full gates are evidence for exercised
paths, not a claim that every warning or dynamic path has been eliminated.

## Final revision evidence protocol

After the final commit, update the PR description with its exact SHA and links
to full CI plus **two sequential complete successful staging runs** on that SHA.
Start the second only after the first succeeds. Check their archive predecessor
chain, exact 381-or-current-inventory resource count, runtime identities, metrics,
full soak and static chunk smoke; retain artifacts before expiry. If the head
changes or a run fails, do not count a previous-head result or partial success.

Record final run IDs in the PR description/report after validation, not by making
another unvalidated repository commit solely to insert its own SHA. Keep PR Draft
while the open acceptance criteria remain; no merge and no production switch.
