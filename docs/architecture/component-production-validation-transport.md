# Component Production validation transport

Candidate identity and validator identity are distinct. Infrastructure remediation
must not change a candidate's pinned base, specification, semantic authority, or
Candidate Snapshot. A protected caller may execute the canonical validation CLI
from a separately pinned, clean tooling checkout, with the candidate as working
directory. Candidate checks and snapshot assertions remain mandatory. The caller
records both revisions; it must not copy tooling fixes into candidate artifacts.

Failed commands retain a complete transcript up to 64,000 characters, removing
only terminal colour escapes. Above that bound an explicit truncation marker is
retained. Incomplete evidence cannot establish an exhaustive candidate-only
failure set. Progress text, command echoes, import chains and wrapper stack frames
are not causal source locations. Repair attribution must inspect every failure,
prefer compiler/module diagnostic locations, bind them uniquely to authorized
candidate artifacts, and retain infrastructure or ambiguous errors as vetoes.

Tooling is not a single dependency-free command. The explicit
`scripts/ci/tooling-build-dependencies.json` manifest separates tests of built
package consumers from source/tooling contracts. Both package builds are scheduled
even for a single-platform candidate because these repository-wide consumer tests
cover both platforms. Failed builds defer only their declared consumers. Source
tooling and token-semantic checks still run, and tooling cannot pass until every
required consumer test really executes successfully. Independent tooling tasks
also collect failures without stopping at the first task.

The production tooling DAG runs validator self-tests, candidate source contracts,
token CLI integration and production fixtures as separate bounded commands. The
production fixture group runs explicitly even on GitHub Actions; ordinary CI's
fixture shard is not implicitly available to a lifecycle job. Built-package
consumers retain their declared build dependencies. Production Vitest commands
use one worker to bound concurrent nested TypeScript fixture compilers on private
runners, and the default reporter preserves parseable failure sections.

Validator self-tests resolve their files and working directory from the pinned
validator checkout. Candidate contracts resolve from the immutable candidate.
An older candidate need not contain a newer validator's self-test files. A
validator self-test failure is explicitly `validation.harness`, even when its
synthetic diagnostics mention a candidate-looking path. Test execution invokes
the installed Node CLIs directly: pnpm 11's implicit dependency verification must
not reinstall a workspace during validation. Dependency installation remains an
explicit setup step, and title-validator tests still use the same installed
commitlint implementation and canonical configuration.
Nested pnpm commands inherit `verifyDepsBeforeRun=false` because fixture roots
deliberately share the already-installed graph. This prevents implicit purging of
shared modules; it does not suppress explicit frozen installs or dependency,
lockfile, typecheck, build, provenance or snapshot validation.

Every tooling task records its start, authority, root and outcome. Cancellation
terminates the active subprocess group and prevents later tasks from starting;
ordinary test failures still allow independent tasks to run. A timeout remains
`validation.runtime` and retains bounded partial output labelled as incomplete
evidence. Neither partial output nor a candidate compiler error can override an
infrastructure failure or establish exhaustive candidate-only ownership.

Visual execution has two transports, not two validation standards:

- Outside a declared canonical environment, run the Docker visual entrypoint.
- Inside the declared pinned Playwright container, run the existing direct visual
  entrypoint. Its environment guard still checks Playwright version, Linux x64,
  Ubuntu noble and the declared environment before executing real visual tests.

An environment declaration selects transport only; it cannot mark visual passed.
Providerless diagnostics use the same transport and only require Docker probes
when Docker is actually the transport. Runtime/environment failures remain
infrastructure findings. Visual readiness still requires the canonical command
to succeed; a dependency-blocked stage cannot grant readiness.

The visual harness, including screenshot baselines, belongs to the pinned validator
revision. It renders the exact candidate through its own Storybook configuration,
tests and component code, without copying a patch into that candidate. The shared
visual runner also serves ordinary repository visual validation. Both transports
use the same runner and the existing canonical environment guard.

Screenshot-only font loading embeds the candidate's exact root-local WOFF2 bytes
and changes only `font-display: optional` to blocking loading. Optional font display
can permanently retain fallback typography after a cold load even when
`document.fonts.ready` resolves. The previously timing-dependent mobile baseline is
corrected from the unchanged canonical reference component with its real fonts.
This is a reviewed baseline correction, not a threshold increase or snapshot mask.
Candidate styles, font assets, geometry, screenshot tolerances and tests are unchanged.

Validation-only resume is an internal lifecycle responsibility. It must reuse the
completed provider response, verify the prior Apply receipt and durable candidate,
leave that receipt immutable, and seal one successor before publishing any repair
request. Tooling changes grant no additional provider write authority or budget.
