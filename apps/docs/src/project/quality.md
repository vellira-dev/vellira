---
title: Quality Assurance
description: Discover how Vellira ensures quality through testing, accessibility verification, Storybook, linting, and continuous integration.
---

# Quality

Quality in Vellira covers documentation, type definitions, component behavior,
testing, and package publishing.

For the lifecycle that combines generation, semantic completion, platform
evidence, these quality checks, and review readiness into one governed component
candidate, see [Component Production](/project/component-production).

## CI Gates

The main CI workflow validates:

- formatting and linting;
- package builds;
- documentation builds;
- TypeScript type checking;
- generated API documentation;
- public API snapshot verification;
- unit tests and coverage;
- Storybook and end-to-end tests;
- package smoke tests.

## Dependency Updates

Dependabot opens automatic pull requests for dependency updates.

The repository checks npm workspace dependencies and GitHub Actions weekly.
Related npm updates are grouped for React, Storybook, Vite, Expo, and linting
tooling.

Security maintenance adds a bounded fallback when a development-scope npm
advisory has a published patched version but Dependabot has not produced a
usable update. High and critical development advisories are checked daily;
lower severities are swept weekly. The fallback may change only pnpm security
overrides, release-age exclusions, and the lockfile. It opens or refreshes one
canonical remediation pull request, then reuses the normal full-CI and
exact-head dependency merge authority.

Runtime dependency alerts are deliberately outside this fallback. They remain
visible in Dependabot; High and Critical runtime alerts also remain surfaced by
the automated security alert watcher. The watcher runs daily and immediately
after dependency manifests, the pnpm lockfile, dependency patch authority, or
dependency policy changes on `main`. Push-triggered checks give GitHub's
asynchronous dependency graph a bounded convergence window before publishing the
tracker; the final evidence records the exact observed main SHA plus each
unmitigated alert's dependency scope and manifest path.

A runtime advisory with no published fixed release may use a temporary verified
backport only when the repository records an exact alert/package/GHSA identity,
upstream commit and blobs, patch path and SHA-256 in
`.github/dependabot-verified-backports.json`. The watcher validates that ledger
against the exact checked-out main revision, `patchedDependencies`, the
lockfile, and a frozen materialization of the patched dependency graph. The
installed patched file must have the exact Git blob identity recorded for the
reviewed upstream fixed file before the raw alert can leave the launch blocker
count. The raw Dependabot alert remains visible. Any patch, installed byte,
lockfile, package identity, scope, manifest, GHSA, or alert-number drift fails
closed and makes the alert effective again. Remove the backport once an upstream
fixed release is available.

## Local Commands

Run the full pipeline before opening a significant pull request.

```bash
pnpm ci
```

Focused checks are faster while developing.

```bash
pnpm docs:build
pnpm typecheck
pnpm test
pnpm check:public-api
pnpm smoke:packages
```

## Documentation Quality

Documentation should explain:

- why a package exists;
- how to install it;
- how to build the first working example;
- how state is controlled;
- how tokens and themes are applied;
- how to test and review the result.

If a public API changes, update the package docs and VitePress pages in the
same pull request.

## Release Quality

Published packages are validated through smoke tests, public export checks,
and automated release verification.

These checks help prevent broken package entry points, missing type
declarations, and unintended API changes.

## Principles

Quality checks should be automated whenever possible.

Every public change should be validated before release through documentation,
tests, type checking, and CI.
