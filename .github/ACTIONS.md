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
  new PR revisions. The locked canonical commitlint configuration is unchanged.
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
  unchanged. IndexNow runs in a separate read-only job after deploy success, using
  the verified candidate SHA and the existing submission script. Notification
  failure is visible in that job and its summary but does not invalidate an
  already verified deployment. Retry `Submit URLs to IndexNow` manually, without
  redeploying production. The manual retry remains failure-reporting.
- Main-push supersession remains a separate trusted cleanup because any main
  advancement must invalidate stale waiting approvals, even when no new website
  staging run is produced. Production-run admission now happens inside the
  production workflow itself: candidate runs are not blocked by workflow-level
  concurrency, stale/duplicate candidates are rejected before environment
  approval, and only the deploy job uses the non-cancelling global concurrency
  group. This covers normal queue admission and reruns without separate
  `workflow_run` Supersede cards. Admission revalidates every cancellation
  target immediately before mutation, waits for GitHub's asynchronous cancellation
  to reach a completed run, then re-reads main and active promotions before
  publishing `admitted=true`. Admission jobs are independently serialized. A
  deploy already queued, in progress or completed remains protected. The deploy
  path also rechecks current `main` immediately before production mutation for
  normal staging-derived candidates.

Do not remove privileged trusted-workflow boundaries or required checks merely
to reduce the number of cards in Actions.

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
