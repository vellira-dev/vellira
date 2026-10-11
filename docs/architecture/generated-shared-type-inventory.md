# Generated shared public type inventory

The component generator synchronizes renderer exports and shared type exports in
`scripts/check-public-api.mjs`. For a shared contract, exported interfaces and type
aliases come from the materialized `packages/types/src/<component>.ts` authority,
including approved domains and object types. No second list of semantic types is
maintained. Unrelated names and runtime exports fail closed.

Normal generation writes shared declarations before inventory synchronization.
Check mode detects inventory drift without writes. Force mode uses the same
synchronizer, and dry-run retains the existing planned registry path. Existing
unrelated symbols remain intact; the canonical public API checker still detects
missing, extra or stale exports.

For an already materialized approved contract, the bounded command is:

```sh
node --import tsx scripts/generators/component/refresh-public-symbol-contract.ts \
  --spec approved-spec.json --check
```

`--write` refreshes only the existing shared inventory block. The command requires
a materialized shared contract and regular repository files, rejects symlink
traversal, reports changed paths and is idempotent. It does not generate or edit
component implementations, approved type declarations, metadata or renderer exports.

This command provides no lifecycle authorization. A protected candidate may use it
only through a separately governed successor transition that verifies the approved
source, exact pinned generator, before/after identities and complete path/mode bounds.
Historical candidate and certification evidence remains immutable.
