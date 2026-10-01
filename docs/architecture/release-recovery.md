# Partial release reconciliation and recovery

## Scope

`.github/workflows/release.yml` has two bounded responses to a partial release.

The normal push path first classifies repository release state:

- **synchronized** — `package.json` exactly matches the latest reachable
  `v<version>` tag, so the normal semantic-release job may run;
- **recoverable** — the latest reachable tag is strictly newer than the manifest,
  so semantic-release is not run again and the workflow attempts automatic
  reconciliation;
- **invalid** — the manifest is not an exact match and is not older than external
  release state, or the version/tag format is invalid, so the workflow fails
  closed before release mutation.

Automatic reconciliation exists only for an externally complete release whose
repository version-sync PR did not reach `main`. It verifies the existing tag,
all six npm packages and provenance, and the existing GitHub Release before it
creates or updates the canonical version-sync PR. It never publishes a package,
creates or moves a tag, or creates/replaces a GitHub Release.

The manual `workflow_dispatch` recovery path remains authoritative for a
genuinely incomplete external release, for example when a package or GitHub
Release is missing. Never delete, move, or recreate an existing release tag.
Never invent the next version to conceal a partial release.

The recovery implementation remains in `release.yml` because npm Trusted
Publishing authorizes the calling workflow filename.

## Authorization

### Automatic reconciliation

No human input is required. A trusted `main` push may enter automatic
reconciliation only when the classifier reports `recoverable`.

Before repository mutation, the verifier requires:

- the workflow is running for a `push` on `refs/heads/main`;
- remote `main` still equals the workflow SHA;
- the latest release tag resolves exactly to the classifier's recorded commit;
- that tagged commit is reachable from current `main`;
- all six exact npm package versions exist with matching integrity and trusted
  provenance. A package produced by an earlier manual recovery attempt may carry
  that recovery run's main SHA rather than the release tag SHA; such a historical
  source is accepted only when it is proven to lie on the inclusive ancestry
  path from the release tag to the current main commit. Divergent, pre-tag, and
  post-current-main sources remain rejected;
- a non-draft, non-prerelease GitHub Release exists and matches the expected tag,
  name, and canonical semantic-release notes.

If any external release artifact is missing or conflicts, automatic
reconciliation stops. It does not escalate itself into a publishing path.

### Manual recovery

Select `main` and provide:

- `release_version`: valid SemVer without `v`;
- `expected_tag_sha`: the reviewed 40-character commit SHA;
- `confirmation`: `RECOVER_EXISTING_RELEASE`.

The controller fails before publication unless remote `main` still equals the
workflow SHA, the tag exists and resolves exactly to `expected_tag_sha`, and the
tagged commit is reachable from `main`.

### Release authentication model

Release publication and repository version synchronization use separate trust
paths:

- npm publication uses Trusted Publishing / OIDC; no npm access token is stored
  for the normal or manual recovery publisher;
- GitHub tag and Release operations use the job-scoped `GITHUB_TOKEN` with the
  workflow's declared repository permissions;
- exact-main seeding/repointing of the temporary version-sync branch uses the
  job-scoped `GITHUB_TOKEN` with bounded Contents permission;
- version-sync PR creation/update, superseded-PR cleanup where applicable, and
  auto-merge use an on-demand GitHub App installation token.

The release-sync App is installed only on `vellira-dev/vellira`. Its repository
permissions are limited to `Contents: write` and `Pull requests: write`. The
workflow requests those permissions explicitly when minting the token, and the
token is scoped to the current repository. Installation tokens expire after one
hour and the token action revokes the token when the job finishes.

Repository configuration required by `.github/workflows/release.yml`:

- Actions variable `RELEASE_SYNC_APP_CLIENT_ID` contains the App client ID;
- Actions secret `RELEASE_SYNC_APP_PRIVATE_KEY` contains the App private key.

The private key must never be printed, copied into repository files, or passed
through workflow outputs. The former `RELEASE_SYNC_TOKEN` personal access token
is not part of the release contract and should be deleted after the GitHub App
cutover is proven.

`GITHUB_TOKEN` is intentionally not used to create version-sync pull requests.
A GitHub App installation token keeps the automation identity non-personal while
allowing normal PR validation workflows and branch-protection checks to remain
authoritative.

Machine-generated version-sync commits intentionally bypass Husky hooks. The
normal release, automatic reconciliation, and manual recovery paths bound their
changes to release-managed manifest and lockfile paths before creating the sync
commit. The resulting PR still runs normal repository validation before
auto-merge can complete.

The normal release job is bounded to 45 minutes, automatic reconciliation to
20 minutes, and manual recovery to 90 minutes. A normal release failure after
immutable external state was created is a partial-release condition. Later
`main` pushes first attempt automatic reconciliation when external state is
already complete; otherwise the manual recovery path is required.

Merges whose head commit starts with
`chore(release): sync package versions` do not run release publication or
reconciliation again; their PR validation remains authoritative.

## Automatic reconciliation algorithm

1. Classify manifest/tag state. Only an older manifest with a newer reachable tag
   enters automatic reconciliation.
2. Recheck exact remote `main`, tag identity, and tag reachability.
3. Read npm metadata and attestations for all six public packages. Every exact
   version must already exist and pass integrity, tarball, trusted workflow, and
   provenance-source verification.
4. Generate the expected GitHub Release identity and notes, then verify the
   existing Release without mutation.
5. Run `scripts/sync-package-versions.cjs` and a lockfile-only install.
   Reject any changed path outside release-managed manifests and `pnpm-lock.yaml`.
6. Seed the single `chore/sync-release-<version>` branch from exact current
   `main`, create/update its PR with the release-sync App, and enable
   `--auto --squash --delete-branch`.

A green automatic-reconciliation job therefore means external release state was
verified and the canonical repository sync PR was created or found with
auto-merge enabled. It does not merely dispatch a second workflow.

## Manual recovery algorithm

1. Read npm metadata and attestations for all six public packages. An existing
   version is satisfied only when integrity, tarball metadata, attestation
   subject digest, trusted workflow, and provenance source are verified.
2. Check out `expected_tag_sha` into a separate directory. If packages are
   missing, install and build that checkout, then run canonical version
   preparation there. Only missing package versions are passed to the shared
   Trusted Publishing implementation. Existing versions are never republished.
3. Re-read and verify all six package versions. This completeness check gates
   every later external mutation.
4. Generate notes from the existing tag and its preceding tag. Create the
   GitHub Release only when absent. An existing exact Release is accepted; an
   existing draft, prerelease, name mismatch, or body mismatch stops recovery
   without overwrite.
5. Run `scripts/sync-package-versions.cjs` and the lockfile-only install in the
   controller checkout, then create/update the canonical version-sync PR and
   enable bounded auto-merge. Protected `main` is never pushed directly.

Every phase rechecks the tag/main relationship. The workflow contains no tag
creation, tag deletion, forced tag update, Cloudflare, deployment, or DNS
operation.

## Release completeness contract

A Vellira release is complete only when:

- all six exact package versions exist on npm;
- all six have integrity, tarball metadata, and expected provenance;
- the tag exists at the intended commit;
- a non-draft, non-prerelease GitHub Release exists for that tag;
- the repository version-sync PR has completed.

The normal publisher performs a final all-six npm completeness gate. Individual
publish command success, a Git tag, or a GitHub Release is not sufficient.

Normal release deliberately separates npm mutation from registry visibility. A
successful `npm publish` means npm accepted the immutable mutation, but it does
not block that worker waiting for `npm view`. Once all six publish mutations
have either been accepted or failed, any true mutation failure stops
immediately. Otherwise all six exact versions are verified concurrently for
integrity, tarball metadata, and provenance under one shared absolute deadline.

The normal all-six gate is bounded by
`VELLIRA_RELEASE_COMPLETENESS_TIMEOUT_MS` (20 minutes by default). This is one
wall-clock visibility budget, not six independent waits and not a second retry
window after per-package verification. The lower-level
`VELLIRA_RELEASE_VERIFICATION_TIMEOUT_MS` remains six minutes by default for
strict per-package verification used by manual partial-release recovery when it
must publish a genuinely missing package.

Progressive retries log elapsed and remaining time, truncate the final sleep to
the shared deadline, and make one final registry attempt there. If normal
release stops after external state becomes complete, a later push may reconcile
repository state automatically. If external state is incomplete or conflicting,
the workflow remains fail-closed and manual recovery is required.

## Incident record

See
[`2026-09-11-v2.104.1.md`](../release-incidents/2026-09-11-v2.104.1.md)
for the incident that established the recovery contract and
[`2026-09-28-v2.124.0.md`](../release-incidents/2026-09-28-v2.124.0.md) for
the npm visibility incident that established the single global completeness
budget.
