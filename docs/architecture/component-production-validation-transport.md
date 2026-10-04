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

Validation-only resume is an internal lifecycle responsibility. It must reuse the
completed provider response, verify the prior Apply receipt and durable candidate,
leave that receipt immutable, and seal one successor before publishing any repair
request. Tooling changes grant no additional provider write authority or budget.
