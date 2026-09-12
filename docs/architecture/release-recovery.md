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
