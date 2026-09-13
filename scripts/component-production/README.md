# Component Production Contract

The Component Production Contract is the versioned machine-readable production
boundary for creating and validating Vellira components.

It sits above Generator V2. The generator remains the deterministic scaffold and
registration mechanism; the production contract supplies the complete approved
intent that must stay synchronized across planning, generation, metadata,
documentation, design resources, validation, and review readiness.

## Commands

Generate from a versioned JSON specification:

```bash
pnpm component-production:json --spec path/to/component.json
```

Validate an existing semantically completed candidate without regenerating it:

```bash
pnpm component-production:validate:json --spec path/to/component.json
```

Both commands emit machine-readable JSON. Validation is the only production path
that may produce `readyForReview: true`.

Controlled production entrypoints and their production-reachable TypeScript
launchers use `node --import tsx`. This supported import hook avoids the tsx
CLI's mandatory IPC listening server, which restricted execution environments
may reject before application code starts. The structured-validation worker
uses the same hook with the current Node executable.

The canonical external package commands above remain unchanged. This bounded
launcher policy does not widen sandbox permissions or ban the tsx CLI throughout
the repository; ordinary development tooling may continue using it.

## Schema V1

A production specification declares component intent explicitly rather than
asking generators or agents to infer it from names or implementation text.

```json
{
  "schemaVersion": "1",
  "componentName": "Disclosure",
  "platform": "both",
  "layer": "components",
  "category": "navigation",
  "profile": "compound",
  "capabilities": [
    "compound-api",
    "controlled",
    "uncontrolled",
    "disabled",
    "keyboard"
  ],
  "dependencies": {
    "packages": ["@vellira-ui/core"],
    "components": ["Tooltip"],
    "platforms": {
      "react": {
        "packages": ["@vellira-ui/icons"]
      },
      "react-native": {
        "packages": ["@vellira-ui/assets"]
      }
    }
  },
  "icons": [
    {
      "name": "ChevronDown",
      "purpose": "disclosure indicator"
    }
  ],
  "tokens": ["semantic.text.primary"],
  "assets": [
    {
      "path": "styles/disclosure.css",
      "purpose": "canonical disclosure surface"
    }
  ],
  "componentTokens": "disclosure",
  "parts": ["Root", "Trigger", "Content"]
}
```

Fields are strict. Unknown fields and unsupported values fail before generation.
Resource and dependency declarations are requirements, not suggestions.

### Dependencies

`dependencies` has three independent scopes:

- root `packages` — canonical package dependencies shared by the component
- root `components` — canonical Vellira component dependencies
- `platforms.react` / `platforms.react-native` — intentional renderer-specific
  package or component dependencies

Renderer-neutral public semantic type ownership is derived from component
semantics. When shared ownership applies, `@vellira-ui/types` is added by the
canonical plan; callers do not maintain a second shared-type registry.

Platform-specific dependency sets are preserved independently. Cross-platform
intent does not mean React and React Native must have identical implementation
dependencies.

### Design resources

The contract can declare canonical:

- icon exports from `@vellira-ui/icons`
- token paths from `@vellira-ui/tokens`
- assets from `@vellira-ui/assets`
- component-token ownership through `componentTokens`

Missing or invalid canonical resources block before component output mutation.
The production path does not invent fallback glyphs, arbitrary token values, or
private asset substitutes.

`componentTokens` may be a supported canonical contract such as `standard`,
`boolean-control`, or `disclosure`, or `false` when the component intentionally
owns no component-token surface.

## Lifecycle

The production lifecycle is explicit and machine-readable:

```text
scaffolded
  -> semantic-completion-required
  -> candidate
  -> validated
  -> ready-for-review
```

A successful scaffold is deliberately not a production-ready component.
Generator output still requires component-specific semantic completion: API and
behavior decisions, controlled/uncontrolled semantics, accessibility, keyboard
or native interaction, platform UX, tests, stories, documentation, and other
requirements expressed by the production contract.

Generation cannot skip that boundary and cannot set `readyForReview: true`.
After semantic completion, the validation-only command evaluates the candidate.
Only a candidate whose canonical validation stages pass can become
`ready-for-review`.

Review and promotion to stable remain separate governance actions outside this
lifecycle.

## Canonical stages

Production evidence uses one ordered stage sequence:

1. `preflight`
2. `generation`
3. `semantic-completion`
4. `format`
5. `lint`
6. `tests`
7. `typecheck`
8. `build`
9. `storybook`
10. `docs`
11. `website`
12. `completeness`
13. `quality`

Every production result contains every stage exactly once. A blocked or failed
result must contain blocking evidence. Skipped required validation cannot be
reported as ready.

## Output evidence

The result groups generated artifacts by production responsibility so agents and
review tooling do not have to rediscover ownership from arbitrary paths:

- `runtimeRenderers`
- `sharedContracts`
- `metadata`
- `designResources`
- `testGeneration`
- `storyGeneration`
- `docsGeneration`
- `websiteGeneration`

The raw artifact list is still preserved, but these groups are the stable V1
summary for downstream production automation.

## Plan / dry-run / write / check parity

One production specification must mean the same thing in every generator mode.

```text
production spec
      |
      v
canonical generation plan
      |
      +--> preflight
      +--> dry-run artifact plan
      +--> write
      +--> check existing generated contract
```

`--dry-run` reports the deterministic runtime, shared-type, metadata, token,
docs, API, and website artifacts and registry updates that the write path owns.
It must not mutate them.

`--check` is read-only and verifies the generated contract against the same plan,
including public API synchronization, shared type ownership, component tokens,
metadata/dependency/resource intent, docs contract, and website component-page
output. Drift is returned as blocking evidence instead of being silently
repaired.

## Fail-closed rules

The production boundary fails closed when it cannot prove that a requested write
or readiness claim is safe. In particular:

- direct writes on the protected/default branch are rejected
- generation requires deterministic preflight before mutation
- missing canonical package, component, icon, token, or asset requirements block
- artifacts may not escape the repository root
- existing generated targets require the explicit generator overwrite contract
- malformed or contradictory metadata/docs registrations block
- shared semantic contracts cannot silently fork into renderer-owned copies
- a scaffold cannot be promoted directly to review readiness
- failed, blocked, or skipped required validation cannot be reported as ready

These rules are production behavior. Tests should model the required canonical
repository structure instead of weakening preflight to accommodate synthetic
fixtures.

## Platform strategy

The contract preserves shared semantic intent where it is real and preserves
platform divergence where it is real.

Examples of legitimate divergence include browser focus/Escape behavior versus
native accessibility/back handling, DOM portals versus native presentation,
hover/pointer behavior versus touch interaction, and platform-specific package
or component dependencies.

The production contract must not force false parity merely because a component
targets both renderers.

## Regression expectations

Changes to this boundary should cover at least these contract shapes:

- full shared-types + core + tokens + icons + assets intent
- minimal component with no core/shared-type/assets requirements
- React-only
- React Native-only
- compound shared semantic API
- overlay shared intent with legitimate renderer divergence
- deterministic metadata/resource drift detection
- website artifact planning and stale-output mapping
- missing canonical resources before mutation
- generation-to-validation lifecycle boundaries

Repository-wide tooling, build, quality, and the normal final-head CI remain the
final authority before this contract is considered ready for review.
