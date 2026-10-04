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
