# Atomic release and Starter synchronization — implementation contract

## Goal

For one completed, verified npm release, produce **one** bot-owned PR containing both
the seven release-managed root/package manifests and the five Workspace Starter
manifest, lockfile and README files. Keep the PR reviewable, required checks and
auto-merge fail-closed.

## Constraints discovered in the current implementation

- `.github/workflows/release.yml` creates the seven-manifest PR after
  semantic-release, and has separate existing-release reconciliation/recovery paths.
- `.github/workflows/workspace-starter-release-sync.yml` triggers from
  the first merged PR and creates a second independent Starter PR.
- `scripts/ci/release-sync-contract.mjs` only accepts exactly seven changed
  manifests as a verified release-sync no-op.
- Production freshness special-cases that exact seven-file change set.
- The Starter lockfile generator requires published npm tarballs with registry
  SHA-512 integrity and is run using pinned Node/npm.

## Required migration (all must land together)

1. After publishing and independently verifying the GitHub Release and **all six**
   exact npm versions, compute Starter pins and integrity-locked npm trees in
   the **same** worktree in which semantic-release prepared the package manifests.
2. Include only the exact twelve permitted files. Reject anything extra and
   verify root, package, README, Starter pins, npm lock integrity and version
   convergence before proposing the PR.
3. Expand the release-sync verifier from a seven-manifest fixed shape to a
   **strictly verified atomic shape**: seven version-only changes plus exactly
   five verified Starter updates. Validate actor, title, SHA lineage and
   contents, never merely allow the file names.
4. Update staging and production release-sync classification and the
   freshness exception together; a benign, verified single atomic sync must
   remain a no-op, while any unverified change still blocks promotion.
5. Update the normal publishing, recoverable-release and manual recovery
   workflows to use the same atomic proposer. Disable the old Starter
   proposal trigger only after the new flow is covered by regression tests.
6. Require the same consumer tests, branch protection and auto-merge checks as
   the previous two-PR design.
7. Exercise release -> one PR -> merge -> no-op staging, recovery after
   partial publish, failed npm dependency resolution, duplicate concurrent
   release events and staging/prod supersession before enabling the workflow.

## Rollout

Keep both existing workflows active until the complete implementation and
tests pass. Do not loosen the current production freshness or release-sync
security exceptions in an incomplete PR. Roll out through a separate reviewed
change; measure actual CI minutes and ensure no second Starter PR appears.

Related: #1897.
