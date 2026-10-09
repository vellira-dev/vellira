# Providerless candidate diagnostics

This advisory collector is deliberately separate from production readiness. It
uses the existing canonical command descriptors, runners, completeness and quality
checkers. It does not generate, repair, deliver, approve, or return a production
result. `readinessAuthority` and `readyForReview` are always false.

Run only in an exclusively owned, credential-free disposable candidate checkout
with the declared dependencies installed. Keep the specification, snapshot and
output outside that checkout. Build/test commands execute repository code and may
write ignored build outputs; exact tracked/untracked source identity is checked
before and after each executed command. Any source drift stops remaining work.

```sh
node --import tsx scripts/component-production/diagnostics-cli.ts \
  --spec /external/normalized-spec.json \
  --candidate-snapshot /external/candidate-snapshot.json \
  --provider-response-sha256 <exact-saved-response-sha256> \
  > /external/diagnostics.json
```

The snapshot uses the existing Candidate Snapshot V1 contract. Its base revision,
fingerprint, the normalized input fingerprint and optional saved-response digest
are included in the report. The digest is provenance metadata, not an approval.
An invalid snapshot prevents both source inspection and command execution.

Independent command failures do not hide later diagnostics. Build-dependent
checks are `dependency-blocked` when their prerequisites fail; they are never
reported as passed. Tests and typechecks still run to collect source-level
findings. A source-backed test may itself report a missing build dependency;
interpret the canonical output rather than treating that as a component defect.

The collector also resolves changed relative TypeScript imports using the nearest
project configuration. Non-code resources such as SCSS must exist at their exact
relative path. This is an early diagnostic, not a replacement for any platform's
full pinned TypeScript, bundler, test or package-boundary checks.

Docker Compose and daemon availability are independently probed before the
canonical visual command. Missing Docker blocks only its dependent visual gate;
smoke/quality and other runnable diagnostics are still collected. The visual
command is not replaced with a different renderer or platform.

Exit 0 means all collected results passed, not production readiness.
Exit 1 means findings were collected. Exit 2 means collection was incomplete,
identity changed, or input/runtime setup was invalid. Read `entries`,
`relativeImports`, `reviewSurfaces`, `inspectionFailures` and `integrityFailures`;
`status: collected` describes collection coverage, not correctness. A report with
skipped/dependent checks is incomplete.

Review-surface inventory is collected with the existing public surface inspector.
Actual candidate browser review, exact approved semantic coverage, authoritative
full validation and Draft PR delivery remain required separately. Presence of
review files is not proof of their runtime behavior or build correctness.
