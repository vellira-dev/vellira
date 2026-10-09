---
title: Component Production
description: Understand Vellira's governed component-production model from approved intent through React and React Native implementation, deterministic validation, and review-ready evidence.
---

# Component Production

Component Production is Vellira's governed path for turning approved component
intent into validated React and React Native UI.

It sits above Generator V2. The generator owns deterministic scaffold,
registration, and generated consequences. Component Production owns the broader
production contract: approved intent, design resources, semantic completion,
platform evidence, validation, and review readiness.

A generated scaffold is not a finished component.

```text
approved intent / spec
        ↓
canonical production plan
        ↓
deterministic generation
        ↓
semantic completion
        ↓
React + React Native implementation
        ↓
tests / accessibility / tokens / API / docs / Storybook / website
        ↓
deterministic validation
        ↓
review-ready evidence
        ↓
human review / lifecycle decision
```

This model currently governs Vellira's canonical component/UI system. It is not
a claim that Vellira already provides a general-purpose engine for initializing,
inspecting, repairing, or maintaining arbitrary external repositories.

## 1. Intent comes before implementation

Vellira separates the reason a component exists from the files that eventually
implement it.

The public metadata layer describes component identity, supported runtimes,
lifecycle, capabilities, dependencies, quality requirements, and approved
component intent.

For expansion targets, intent includes:

- the reusable UI job;
- capabilities required on every declared platform;
- platform-specific requirements where Web and React Native legitimately differ.

For example, a shared component may require accessible naming on both runtimes
while a keyboard requirement applies only to React.

The important rule is:

> File existence is not semantic coverage.

A component folder, generated scaffold, or matching export name cannot satisfy
an approved intent when required behavior or platform evidence is still missing.

Public sources:

- [Component metadata](https://github.com/vellira-dev/vellira/tree/main/packages/metadata)
- [Component intent coverage](https://github.com/vellira-dev/vellira/blob/main/packages/metadata/src/componentIntent.ts)
- [Expansion catalog](https://github.com/vellira-dev/vellira/blob/main/packages/metadata/src/expansionCatalog.ts)

## 2. One production specification, one canonical plan

The Component Production contract is versioned and machine-readable.

A production specification declares the component name, target platform,
layer, category, profile, capabilities, dependencies, canonical icons, tokens,
assets, component-token ownership, and work-item provenance where required.

The same specification feeds one canonical generation plan.

```text
production spec
      ↓
canonical plan
      ├─ preflight
      ├─ dry-run
      ├─ write
      └─ check
```

Dry-run, write, and check must agree about the artifacts and registrations the
generator owns. Drift is reported as evidence rather than silently accepted.

Generate from a production specification:

```bash
pnpm component-production:json --spec path/to/component.json
```

Validate an already completed candidate without regenerating it:

```bash
pnpm component-production:validate:json --spec path/to/component.json
```

The full public contract is documented in the repository:

- [Component Production Contract](https://github.com/vellira-dev/vellira/blob/main/scripts/component-production/README.md)
- [Generator V2](https://github.com/vellira-dev/vellira/blob/main/scripts/generators/component/README.md)

## 3. Canonical resources fail closed

Generation may use only canonical Vellira resources declared by the production
contract.

That includes:

- component and package dependencies;
- shared types;
- design tokens;
- component-token ownership;
- icons;
- assets.

Missing resources are not an invitation to invent substitutes.

A missing token, icon, dependency, lifecycle reservation, or other required
authority blocks the production path until the canonical resource exists.

This is intentional. Production should expose a reusable system gap instead of
hiding it inside one component implementation.

## 4. Generation is structural, semantic completion is separate

Generator V2 is deliberately deterministic. It can create and synchronize
owned structure, but it does not get to invent unresolved product semantics.

After generation, component-specific work may still include:

- public API and state semantics;
- controlled and uncontrolled behavior;
- accessibility behavior;
- keyboard or touch interaction;
- focus management;
- fallback and error behavior;
- runtime-specific implementation details;
- component-specific tests and examples;
- design and presentation decisions.

Vellira calls this boundary semantic completion.

```text
scaffolded
    ↓
semantic-completion-required
    ↓
candidate
    ↓
validated
    ↓
ready-for-review
```

Generation alone cannot set `readyForReview: true`.

Only the canonical validation path can make that claim, and human review or
Stable promotion remains a separate decision after validation.

## 5. Shared intent does not mean false platform parity

React and React Native share semantic intent where it is real. They are allowed
to diverge where the runtime requires different mechanisms.

Examples:

| Shared requirement   | React / Web                                    | React Native                                      |
| -------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Accessible name      | semantic HTML, `aria-label`, `aria-labelledby` | `accessibilityLabel`, native accessibility APIs   |
| Activation           | click and native button keyboard semantics     | press / native touch semantics                    |
| Focus handling       | DOM focus and keyboard focus visibility        | native focus behavior                             |
| Overlay presentation | portal, Escape, browser focus management       | native modal/presentation and back/touch handling |
| Interaction state    | hover, pointer, focus, pressed                 | press, long-press, touch, native focus            |

Cross-platform quality therefore means that each runtime satisfies its own
explicit contract. It does not mean that the implementations, event APIs, DOM
structure, or interaction mechanics must be identical.

Related public guidance:

- [Component conventions](https://github.com/vellira-dev/vellira/blob/main/docs/COMPONENT_CONVENTIONS.md)
- [Accessibility contract](https://github.com/vellira-dev/vellira/blob/main/docs/ACCESSIBILITY.md)

## 6. Validation is production evidence

Component Production uses an ordered validation lifecycle.

The canonical public stage sequence currently covers:

1. preflight;
2. generation;
3. semantic completion;
4. formatting;
5. lint;
6. tests;
7. type checking;
8. build;
9. Storybook;
10. docs;
11. website;
12. component completeness;
13. Component Quality;
14. public API;
15. tooling;
16. visual validation;
17. smoke validation.

Required stages cannot be skipped and still produce a review-ready result.

The deeper checkers have separate responsibilities:

- **Completeness** asks whether required implementation and public artifacts exist.
- **Component Quality** asks whether declared behavior, accessibility, interaction,
  platform, token, documentation, and other quality contracts are actually satisfied.
- **Public API checks** verify supported package exports and type surfaces.
- **Lifecycle / Stable checks** govern explicit graduation after production readiness.

Related public references:

- [Component Quality Checker](https://github.com/vellira-dev/vellira/blob/main/scripts/checks/component-quality/README.md)
- [Component Quality Model](https://github.com/vellira-dev/vellira/blob/main/docs/architecture/component-quality-model-v1.md)
- [Component lifecycle and Stable graduation](https://github.com/vellira-dev/vellira/blob/main/docs/architecture/component-lifecycle.md)

## 7. Exact candidate identity matters

Validation evidence must describe the candidate that was actually inspected.

For a clean revision, the Git revision can provide that identity. For an
intentional pre-delivery working-tree candidate, Component Production supports a
bounded Candidate Snapshot contract that binds:

- the exact base revision;
- changed paths;
- file states and modes;
- content digests.

If the checkout drifts after the snapshot or during review-surface inspection,
the readiness claim blocks.

This prevents a common failure mode where tests prove one candidate while a
different candidate is later presented for review.

## 8. Review surfaces are part of production

A production-ready component is more than runtime code.

Applicable review evidence can include:

- React implementation;
- React Native implementation;
- shared contracts;
- metadata;
- tests;
- Storybook states;
- documentation;
- website component pages;
- accessibility notes;
- public exports;
- design-resource evidence;
- visual and smoke results.

Component Production groups these artifacts by responsibility so review and
automation do not have to rediscover ownership from arbitrary file paths.

A Draft PR or generated artifact is not acceptance by itself. The exact
candidate still passes through normal human review and repository CI.

## 9. Human judgment stays explicit

Vellira automates deterministic work aggressively, but it does not disguise
subjective product judgment as a deterministic check.

Human review remains relevant for questions such as:

- whether a public API is appropriate;
- whether a component visually feels finished;
- whether an interaction is idiomatic on a platform;
- whether documentation communicates the behavior clearly;
- whether a validated candidate should be promoted to Stable.

The Stable lifecycle gate requires explicit approval in addition to applicable
deterministic evidence.

## 10. What Component Production guarantees

The current model is designed to make these guarantees enforceable:

- approved intent exists before implementation;
- deterministic generation has one canonical plan;
- missing canonical resources block rather than produce local substitutes;
- generation cannot self-certify semantic completeness;
- Web and React Native may diverge intentionally without creating false parity;
- required quality evidence is evaluated independently by platform where needed;
- candidate identity is bound to validation evidence;
- skipped or failed required validation cannot become review-ready;
- public API, docs, Storybook, website, metadata, and runtime output are treated
  as parts of one component-production result;
- Stable promotion remains an explicit governance decision.

## 11. What it does not claim

Component Production does not currently mean:

- arbitrary external repositories are automatically initialized or repaired;
- semantic or design decisions are fully autonomous;
- generated code is accepted without review;
- failing quality gates are weakened to make a candidate pass;
- React and React Native must expose identical runtime mechanics;
- roadmap-only Pro, Cloud, Studio, or broader UI Operating System capabilities
  are already shipped.

Those boundaries are part of the product contract, not temporary documentation
caveats.

## Related documentation

- [Quality](/project/quality)
- [Accessibility](/design-system/accessibility)
- [Component lifecycle and Stable graduation](https://github.com/vellira-dev/vellira/blob/main/docs/architecture/component-lifecycle.md)
- [Component Production Contract](https://github.com/vellira-dev/vellira/blob/main/scripts/component-production/README.md)
- [Component metadata](https://github.com/vellira-dev/vellira/tree/main/packages/metadata)
