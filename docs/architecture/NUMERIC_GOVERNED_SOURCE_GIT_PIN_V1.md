# Governed Source Provenance V1 — numeric Git source pin (pre-admission)

**Status: review-only Git object/content preflight. The result never authenticates a repository, a reviewer, a human decision, or production authorization.** This is the first source-content step after the independent numeric receipt resolver (#1734), not a duplicate of the existing private GitHub human-attestation authority.

## Existing sources of truth

Component Program decisions are already governed by `parseComponentProductionInput`, the public compiler, the deterministic Git-aware production identity and private authenticated human decision gates. The private semantic-planning source-layout review reads GitHub afresh, checks exact comment/PR identities and authorized human numeric GitHub IDs, and does **not** convert a content hash into a production grant. V1 reuses that split.

The public Node-only `prepareNumericSourceGitPinV1(checkoutRoot, pin, evidence)` performs deterministic **source-content** binding against a local, externally provisioned Git checkout. It does not itself contact GitHub or authenticate the checkout. Even a valid-looking `remote.origin.url` is local mutable configuration. An attacker can create a synthetic Git repository with that remote; this is covered by a positive adversarial control asserting `sourceAuthenticated: false` and `ownerApproved: false`.

## Exact input and bounds

```ts
{
  schemaVersion: '1',
  repository: 'vellira-dev/vellira',
  revision: '<40 lowercase hex Git commit SHA-1>',
  sourcePath: 'scripts/component-production/specs/SomeComponent.json',
}
```

The locator is captured using the existing descriptor-only input capture, with exact four keys, a canonical repository identity, a full immutable revision and a single finite `scripts/component-production/specs/[Component].json` file path. Invalid fields, getters, revoked Proxies, unknown repositories, path traversal, alternate extensions and misshaped SHA values are rejected **before invoking Git**. The configured `checkoutRoot` is an externally supplied path and must be trusted by the caller.

The preflight reads Git **without shell interpolation**. It checks that `checkoutRoot` is the real repository top level, that the locally configured remote has the exact Vellira URL form, that HEAD is the pinned commit, and that Git identifies that object as a commit. `GIT_*` environment settings are stripped from each subprocess before setting `GIT_NO_REPLACE_OBJECTS=1` and read-only optional-lock behavior. Every Git subprocess has finite time and output bounds. Git `ls-tree` must show an exact ordinary tracked regular-file blob at the pinned commit, excluding symlinks, directories and submodules.

The reader fetches bytes from the pinned **Git blob object**, not the working tree. It caps source bytes at 128 KiB, independently checks Git's SHA-1 blob object identity, and emits a distinct SHA-256 digest of the exact committed bytes. The decoded UTF-8 JSON must pass the canonical existing `parseComponentProductionInput`. The pinned file path must also equal `scripts/component-production/specs/${production.componentName}.json` **exactly**, including case; a correctly hashed and independently receipted spec committed as a different component's file fails closed as `invalid-source`. On that pinned spec, the already reviewed `resolveNumericBindingReceiptsV1` must revalidate every finite slot, program/source root, numeric dataset and authority receipt; the exact unresolved Numeric Grammar denial remains in force. A second HEAD read rejects a moving checkout during this inspection.

## Output meaning

A successful result includes only an immutable source-content identity and the existing immutable content-resolution result, always:

- `disposition: 'review-required'`
- `sourceContentMatched: true`
- `sourceAuthenticated: false`
- `ownerApproved: false`
- `grammarAdmitted: false`

The returned `gitBlobSha1` and `sourceBytesSha256` bind exact bytes; they are **not** evidence of an approved source. Caller-controlled Git history or configuration can mint plausible matching hashes, so the separate protected authenticated workflow MUST establish real GitHub origin and trusted human ownership. Even a trusted source commit alone must not admit Numeric Grammar, geometry, SSR, accessibility, provider calls, Factory or public release.

The test fixtures deliberately create temporary local Git repositories, use fake configured GitHub remotes and never make external requests. They prove fail-closed parsing, HEAD and file identity, refusal of symlinks, bound bytes versus dirty working trees, tampered datasets/receipts, and explicit non-authorization of a counterfeit local repository. They are **not** production provenance samples.

## Next independent governed admission gate

The next private authenticated lane must first verify an exact GitHub repository/commit and the matching tracked blob through a protected GitHub source, confirm that the source commit is the authorized reviewed revision, and require an explicit owner decision with the established numeric GitHub identity and freshness rules. It must independently repeat the numeric resolution and honor the existing protected CI/review chain. No implicit approval is derived from `ok`, local Git remotes, content digests, CI GREEN or merging this PR.

A separate governed decision must ultimately admit numeric semantics and geometry/accessibility proof. This PR implements **neither** an authenticated remote GitHub client nor that admission.
