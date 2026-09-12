# Partial release recovery

## Scope

The manual recovery path in `.github/workflows/release.yml` exists only for a
semantic-release run that already created `v<version>` and then stopped before
all external and repository release state was complete. Never delete, move, or
recreate the tag. Never invent the next version to conceal a partial release.

The recovery remains in `release.yml` because npm Trusted Publishing authorizes
the calling workflow filename. It is a separate `workflow_dispatch` job; it
cannot run on push and the normal semantic-release job cannot run on dispatch.

## Authorization

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
  for the normal or recovery publisher;
- GitHub tag and Release operations use the job-scoped `GITHUB_TOKEN` with the
  workflow's declared repository permissions;
- version-sync branch, pull-request, superseded-PR cleanup, and auto-merge
  operations use an on-demand GitHub App installation token.

The release-sync App is installed only on `vellira-dev/vellira`. Its repository
permissions are limited to `Contents: write` and `Pull requests: write`. The
workflow requests those two permissions explicitly when minting the token, and
the token is scoped to the current repository. Installation tokens expire after
one hour and the token action revokes the token when the job finishes.

Repository configuration required by `.github/workflows/release.yml`:

- Actions variable `RELEASE_SYNC_APP_CLIENT_ID` contains the App client ID;
- Actions secret `RELEASE_SYNC_APP_PRIVATE_KEY` contains the App private key.

The private key must never be printed, copied into repository files, or passed
through workflow outputs. The former `RELEASE_SYNC_TOKEN` personal access token
is not part of the release contract and should be deleted after the GitHub App
cutover is proven.

`GITHUB_TOKEN` is intentionally not used to create version-sync pull requests:
workflow-created PR events authenticated with the repository token require
special approval semantics and are not suitable for unattended required-check
and auto-merge flow. A GitHub App installation token keeps the automation
identity non-personal while allowing the normal PR validation workflows to run.

## Algorithm

1. Read npm metadata and attestations for all six public packages. An existing
   version is satisfied only when integrity, tarball metadata, attestation
   subject digest, trusted workflow, and provenance source are verified.
2. Check out `expected_tag_sha` into a separate directory. If packages are
   missing, install and build that checkout, then run the canonical version
   preparation there. Only missing package versions are passed to the shared
   Trusted Publishing implementation. Existing versions are never republished.
3. Re-read and verify all six package versions. This completeness check gates
   every later external mutation.
4. Generate notes from the existing tag and its preceding tag. Create the
   GitHub Release only when absent. An existing exact Release is accepted; an
   existing draft, prerelease, name mismatch, or body mismatch stops recovery
   without overwrite.
5. Run `scripts/sync-package-versions.cjs` and the lockfile-only install in the
   controller checkout, then create or update the reviewable
   `chore/sync-release-<version>` PR. Protected `main` is never pushed directly.

Every phase rechecks the tag/main relationship. The workflow contains no tag
creation, tag deletion, forced update, Cloudflare, deployment, or DNS operation.

## Release completeness contract

A Vellira release is complete only when:

- all six exact package versions exist on npm;
- all six have integrity, tarball metadata, and expected provenance;
- the tag exists at the intended commit;
- a non-draft, non-prerelease GitHub Release exists for that tag;
- the repository version-sync PR has completed.

The normal publisher performs a final all-six npm completeness gate. Individual
publish command success, a Git tag, or a GitHub Release is not sufficient.
Registry visibility is bounded by the explicit
`VELLIRA_RELEASE_VERIFICATION_TIMEOUT_MS` deadline (six minutes by default).
Progressive retries log elapsed and remaining time, truncate the final sleep to
the deadline, and make one final registry attempt there.

## Incident record

See
[`2026-09-11-v2.104.1.md`](../release-incidents/2026-09-11-v2.104.1.md)
for the incident that established this recovery contract.
