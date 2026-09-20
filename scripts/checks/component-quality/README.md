# Component Quality Checker

## CI enforcement rollout

Normal PR CI currently runs Component Quality in blocking mode. The staged
advisory rollout described below is retained as historical context.

### Advisory mode

`COMPONENT_QUALITY_ENFORCEMENT=advisory`

- `PASS` is non-blocking.
- `WARN` is non-blocking.
- `FAIL` is reported with exit code `1` but does not block CI.
- `not-applicable` is neutral.
- Runtime/configuration errors use exit code `2` and remain blocking.
- Machine-readable JSON reports are retained as CI artifacts.

### Enabling blocking enforcement

Switch to:

`COMPONENT_QUALITY_ENFORCEMENT=blocking`

only when:

- the V1 rule set has regression coverage;
- representative Web, React Native, and cross-platform fixtures are covered;
- intentional Web / React Native implementation divergence is covered;
- known false positives have regression tests;
- the checker has completed a calibration period in real CI;
- no unresolved systematic false positives remain;
- existing stable components do not produce unexplained `FAIL` results;
- machine-readable and human-readable output remain deterministic;
- runtime failures remain distinguishable from component quality failures.

Switching enforcement mode must not require changes to checker semantics or
rule implementations.

### Blocking mode

- `PASS` remains non-blocking.
- `WARN` remains non-blocking.
- `FAIL` blocks CI with exit code `1`.
- Runtime/configuration errors block CI with exit code `2`.
- `not-applicable` remains neutral.
- Machine-readable reports continue to be retained.

### Current normal PR CI enforcement

`COMPONENT_QUALITY_ENFORCEMENT=blocking`

- `PASS` is non-blocking.
- `WARN` is non-blocking.
- `FAIL` is blocking.
- Runtime/configuration errors are blocking.

### CI report

CI generates the machine-readable report with:

`pnpm check:component-quality:json`

and uploads `.artifacts/component-quality/report.json` as the
`component-quality-report` artifact.

## Design resource authority

Generated and completion-owned component code must use canonical Vellira design
resources instead of inventing local visual substitutes.

For icons:

- use existing exports from `@vellira-ui/icons`;
- declare component-owned required icons in `requirements.icons` with a canonical
  export `name` and semantic `purpose`;
- do not use Unicode/ASCII glyphs as UI icon fallbacks;
- do not add local/inline SVG icon artwork or direct `react-native-svg` icon
  implementations when the component requires a Vellira icon.

For colors and other token-owned visual values:

- use the established Vellira CSS token/style path on Web;
- use `theme.tokens.*`, `theme.components.*`, or `theme.semantic.*` on React
  Native;
- do not hardcode a visual fallback because a desired semantic token is absent.

Missing resources fail closed. A `missing-icon-resource` or `missing-design-token` finding
means the component is not production-ready. Add the required icon or token
through its canonical Vellira package/factory first, then rerun
generation/completion and Component Quality. Completion or bounded repair may
switch to an existing canonical resource, but must not invent a missing one.

## GitHub issue synchronization

The issue synchronization layer is separate from the checker engine. It consumes
the V1 report, normalizes actionable findings, plans deterministic lifecycle
operations, and only then applies GitHub mutations.

Default synchronization policy:

- `FAIL` findings are actionable.
- `WARN` findings are ignored unless `--warn` is passed explicitly.
- `PASS` and `not-applicable` never create issues.
- managed issues are identified by a stable HTML marker derived from component,
  platform, and rule identity.
- unmanaged issues are never modified by the synchronizer.

Preview operations without mutations:

`pnpm component-quality:issues --dry-run`

Synchronize FAIL findings:

`GITHUB_TOKEN=... pnpm component-quality:issues`

Include WARN findings explicitly:

`GITHUB_TOKEN=... pnpm component-quality:issues --warn`

Consume an existing machine-readable report instead of running the checker:

`pnpm component-quality:issues --dry-run --report .artifacts/component-quality/report.json`

The repository defaults to `vellira-dev/vellira` and can be overridden with
`--repo owner/name` or `GITHUB_REPOSITORY`. GitHub labels are applied only when
the corresponding labels already exist in the target repository.

The planner supports deterministic `create`, `update`, `close`, and `reopen`
operations. Closing and reopening managed issues is marked automatically in the
issue lifecycle.

### GitHub Actions automation

`.github/workflows/component-quality-issues.yml` runs after a successful `CI`
workflow on `main`. The workflow checks out the exact commit that passed CI,
generates a fresh V1 report, and synchronizes `FAIL` findings with managed GitHub
issues.

The workflow has only `contents: read` and `issues: write` permissions. Pull
request CI does not receive issue-write permissions from this automation path.
Concurrent synchronization runs are serialized to prevent overlapping issue
writes.

The automatic post-main path performs real synchronization. Manual execution is
available through `workflow_dispatch` and defaults to `dry_run: true`, which
prints planned operations without mutating GitHub issues. Set `dry_run` to
`false` explicitly to perform a manual synchronization.

The automation preserves the synchronization lifecycle contract:

- new finding → create;
- materially changed finding → update;
- resolved finding → close;
- regressed finding → reopen;
- unchanged finding → no write.

`WARN` findings remain excluded from automatic synchronization. The workflow
retains the generated report as the `component-quality-issue-sync-report`
artifact for inspection.
