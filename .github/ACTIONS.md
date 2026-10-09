# Actions delivery and diagnostics

## Publish coherent changes

Prepare and validate a complete logical change before publishing its branch head.
A multi-file change must be delivered in one coherent commit, not as one commit
per file. With the GitHub API, create blobs/tree/commit first and update the branch
reference only after that tree is complete. Never force-push merely to hide a
failed validation attempt.

Run available focused tests and formatting checks before publishing. Record
validation limitations honestly. Hosted CI establishes exact-head evidence; it
is not a substitute for a local editing scratchpad. Concurrency supersedes stale
work, but does not prevent a workflow card from being created for each push.

## Preserved validation boundaries

- `Validate PR title` remains required and runs on `synchronize` as well as title
  edits. Removing that event without an equivalent exact-head check can strand
  new PR revisions. The job checks out the trusted PR base SHA and requires the
  already-adopted `tools/pr-title-validator` authority to exist there. It then
  deploys only that package from the trusted workspace into an isolated temporary
  directory using pnpm's dedicated-lock deploy path. The command enables injected
  workspace packaging only for deploy so pnpm can derive a pruned lock from the
  trusted shared root lockfile; no workspace dependency is added to the validator.
  The root lockfile and workspace overrides remain the single resolution authority,
  while the deployed package receives its own isolated node_modules instead of the
  monorepo's hoisted tree. A hosted guard fails if that deployed virtual store
  expands beyond 300 package snapshots.
  Validation still
  executes the repository's canonical root `commitlint.config.js`; no regex
  policy, floating `dlx` dependency or second independently maintained policy is
  introduced.
- The strict token semantic audit remains in `ci:quality`; the separate detailed
  report is available through its manual workflow.
- `Lighthouse / Docs` owns the fresh-checkout docs deployment-build regression:
  no workspace dist before build, docs dependency build, docs build, and artifact
  assertion. The deploy workflow retains main/manual deployment only.
- Chromatic, Lighthouse and title concurrency groups are distinct and PR-scoped.
  Non-PR runs use independent run IDs rather than replacing pending main/manual
  evidence.
- Draft-to-ready transitions do not rerun CI, CI Performance Budget or PR Title
  for an unchanged SHA. Those checks already run on draft opening and synchronize;
  reopened PRs still rerun. Dependabot metadata retains `ready_for_review` because
  a draft Dependabot PR is intentionally skipped until it becomes reviewable.
- Production candidate qualification, approval, deployment and verification remain
  distinct. Protected `production` environment review happens in a dedicated
  approval job that binds the immutable candidate SHA but does not hold deployment
  concurrency or receive Cloudflare secrets. The deployment job starts only after
  that approval succeeds and then acquires the serialized production deploy mutex.
  The Cloudflare account/token secrets are already available to staging and the
  legacy-adoption production workflow without a deployment environment; moving
  the environment gate upstream does not copy or expose them through job outputs. IndexNow runs in a separate
  read-only job after deploy success, using
  the verified candidate SHA and the existing submission script. Notification
  failure is visible in that job and its summary but does not invalidate an
  already verified deployment. Retry `Submit URLs to IndexNow` manually, without
  redeploying production. The manual retry remains failure-reporting.
- Production admission is read-only. Exact-current-main staging candidates are
  preferred. A staged ancestor may remain eligible only when every path changed
  between that candidate and authoritative current `main` is outside the
  canonical website deployment surface mirrored by the staging workflow path
  filters, including shared root build configuration such as `tsconfig.base.json`.
  Any website/package/lockfile/build-config/deploy-workflow drift, divergent history,
  ambiguous comparison, or unknown candidate state fails closed. Same-SHA reruns
  retain one admission owner. Vellira does not automatically cancel or reject a
  production environment review: GitHub environment review is a human reviewer
  boundary and the default workflow token is not treated as reviewer authority.
  If `main` advances while an older production approval is waiting, admission
  and deploy both re-evaluate deployment equivalence. The deployment script checks
  again before remote archive mutation and after the Wrangler dry-run immediately
  before real activation. Deployment-irrelevant repository work therefore cannot
  strand an otherwise valid staged website, while deployment-relevant drift can
  never ride an older candidate into production. Emergency recovery remains an
  explicit bypass. Admission stays read-only with its own non-cancelling
  concurrency group; protected approval waits hold no deploy mutex; deployment
  serialization begins only after approval succeeds. No workflow auto-cancels a
  pending production environment review or an active production deployment.

Do not remove privileged trusted-workflow boundaries or required checks merely
to reduce the number of cards in Actions.

## Immutable candidate quality checks

The quality job keeps the exact PR head in a separate candidate checkout and the
exact workflow revision in a tooling checkout. It preserves every command and
argument in the candidate's `ci:quality` recipe. Only the two read-only website
projection gates use the workflow's canonical generator and audit implementation,
including nested generator commands; candidate implementation and metadata remain
unchanged. Missing projection gates or unsupported shell syntax fail closed.
Both Git revisions and clean source trees are checked before and after commands,
and the job retains the recipe digest, command results and both identities.

Cloudflare lint and smoke-policy tests use a fixed source-check profile loaded
from the exact workflow Git revision. The candidate retains the required baseline
scripts and tests. Each additional recovery module present in that candidate must
have its matching test; both are checked. A historical candidate need not contain
features added later on main. Empty baseline families and missing module/test
pairs fail closed. Runtime builds still bind the exact candidate SHA. No missing-
file suppression or successful fallback is permitted. After a reviewed workflow
fix merges, reopening an unchanged Draft PR can obtain current-workflow checks
without rebasing its certified commit.

## Release candidate consumer proof

Release Candidate Proof packs the exact candidate head and binds every retained
tarball digest to that SHA. Clean Vite, Next.js and Expo consumers run the harness
at the exact workflow revision (`github.sha`, the PR merge revision for PR runs),
so an older candidate can be tested with current compatibility tooling. Each
consumer records and verifies the harness Git SHA independently of its package
candidate SHA and rejects tracked harness drift. First-use documentation checks
continue to read the exact candidate documentation. Current harness tooling does
not grant authority to replace candidate tarballs or skip compatibility checks.

## Permanent component diagnostics

Use `Component Diagnostics` from the `main` workflow definition. Supply an exact
40-character lowercase commit SHA from this repository and one fixed profile:
`component-production`, `component-quality`, `token-semantic`, or `tooling`.
Mutable refs and arbitrary shell commands are rejected. No deployment environment,
repository secrets or repository write permissions are provided. The diagnostic
job declares `cache-mode: none`, so selected candidate code cannot restore or save
GitHub Actions caches.

The workflow verifies the checked-out SHA and publishes revision, profile, run
identity, diagnostic output and outcome evidence with a 14-day retention window.
A failed diagnostic command remains failed, including when output passes through
`tee`. This manual evidence does not replace required PR checks.

Use this entry point instead of adding component-specific temporary workflow
files. A new diagnostic capability belongs in a reviewed fixed profile or a
repository-owned test, not a free-form command input.

## Rollout evidence

An open PR is not a completed rollout. Before closing the cleanup, verify the
final-head CI, then observe the adopted workflows after an authorized merge:
PR supersession, the clean docs build, one successful production notification,
and a manual diagnostics run. Do not approve a deployment solely to exercise
this cleanup. Historical cancelled or failed runs are retained as evidence.

Lightweight title dependency installation and broader workflow-trigger
consolidation remain separate changes; their gate and queue semantics must be
proven before existing behavior is removed.

## Engineering change admission

The existing `PR Title` workflow also owns the read-only Engineering Change
Admission backstop. It runs `scripts/ci/pr-change-intent.mjs` from the trusted PR
base checkout before dependency installation and keeps the required check name
unchanged. The workflow retains only `contents: read` and `pull-requests: read`
permissions; it never creates, edits, closes, merges, or retargets a PR.

Creator-side preflight remains the primary duplicate-prevention mechanism because
it runs before PR creation. CI exists to catch bypasses and races: newly admitted
PRs outside the trusted automation allowlist require one stable root-problem marker,
and a second open
PR with the same marker fails closed. Historical PRs created before the adoption
cutoff remain grandfathered. Only the explicitly reviewed bot identities in the
trusted-base validator bypass the marker. PR body text, branch names, titles, and
delivery markers cannot grant an exemption; unrecognized automation must carry a
normal change-intent marker or fail closed.

The first adoption PR is the only bootstrap case where the trusted base can lack
the validator. In that case the workflow records `change_intent_adopted=false`
and does not execute candidate validator code. Once the validator is present on
`main`, every subsequent PR runs the trusted-base admission check.
