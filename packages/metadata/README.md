# @vellira-ui/metadata

Internal metadata contracts for Vellira components and tooling.

## Purpose

This package describes component-level requirements independently from
website presentation metadata.

It is intended to become a shared contract for:

- component generation
- completeness checks
- CI validation
- documentation tooling
- future maintenance automation

## Scope

V1 describes:

- component identity
- layer and category
- supported platforms
- lifecycle status
- capabilities
- platform-scoped capability evidence
- approved component intent and capability coverage
- dependencies
- test requirements
- Storybook requirements
- documentation requirements
- accessibility requirements
- token requirements

Website-specific demo, playground, example, and presentation metadata remain
outside this package.

## Component metadata V1

V1 describes the engineering contract for a Vellira component.

It does not describe the full component API, website presentation, playground
configuration, examples, or generated documentation content.

### Example

```ts
import { defineComponentMetadata } from '@vellira-ui/metadata';

export const selectMetadata = defineComponentMetadata({
  name: 'Select',
  layer: 'components',
  category: 'form',
  platforms: ['react', 'react-native'],
  status: 'stable',

  capabilities: [
    'controlled',
    'uncontrolled',
    'disabled',
    'required',
    'invalid',
    'loading',
    'compound-api',
    'portal',
  ],
  platformCapabilities: {
    react: ['keyboard', 'focus-management'],
  },

  dependencies: {
    packages: ['@vellira-ui/types', '@vellira-ui/core', '@vellira-ui/icons'],
  },

  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
});
```

## Fields

### `name`

Public component name.

### `layer`

Source layer where the component belongs:

- `primitives`
- `components`
- `patterns`

### `category`

High-level product category:

- `action`
- `form`
- `navigation`
- `overlay`
- `feedback`
- `data-display`
- `layout`
- `utility`

Category describes the component's role, not its source directory.

### `platforms`

Supported runtime implementations:

- `react`
- `react-native`

A component must support at least one platform.

### `status`

Lifecycle state:

- `experimental`
- `beta`
- `stable`
- `deprecated`

See [Component lifecycle and Stable graduation](../../docs/architecture/component-lifecycle.md)
for the canonical semantics and promotion contract.

### `capabilities`

Important behavior implemented across every declared platform. Tooling may use
this evidence when generating or validating a component.

V1 capabilities include:

- `controlled`
- `uncontrolled`
- `indeterminate`
- `disabled`
- `required`
- `invalid`
- `loading`
- `keyboard`
- `focus-management`
- `compound-api`
- `multiple`
- `collapsible`
- `portal`
- `responsive`
- `accessible-name`
- `accessible-value`
- `announcement`
- `auto-dismiss`
- `dismissible`
- `fallback`
- `image-source`
- `multiline`
- `reduced-motion`
- `size-variants`
- `stacking`
- `value-range`

Capabilities should describe meaningful engineering behavior.

Do not add every prop, visual variant, event, or implementation detail as a
capability.

### `platformCapabilities`

Optional evidence for behavior implemented on one declared platform rather
than every platform. This keeps Web and React Native differences explicit
instead of pretending they have identical semantics.

```ts
const platformCapabilities = {
  react: ['keyboard', 'focus-management'],
  'react-native': ['announcement'],
};
```

A platform-specific capability must not repeat a shared `capabilities` entry,
and its platform must already be declared in `platforms`.

### `dependencies`

Declares relevant package and component dependencies.

```ts
const dependencies = {
  packages: ['@vellira-ui/types'],
  components: ['FormField'],
};
```

This is intended for tooling and completeness validation, not as a replacement
for `package.json`.

### `requirements`

Defines which quality artifacts are required for the component.

```ts
const requirements = {
  tests: true,
  storybook: true,
  docs: true,
  accessibility: true,
};
```

Canonical design-token requirements can be declared with exact token paths:

```ts
const requirements = {
  tests: true,
  storybook: true,
  docs: true,
  accessibility: true,
  tokens: ['semantic.text.primary'],
};
```

Component-owned canonical icon requirements can also declare the expected
`@vellira-ui/icons` export and its semantic purpose:

```ts
const requirements = {
  tests: true,
  storybook: true,
  docs: true,
  accessibility: true,
  icons: [
    {
      name: 'ChevronDown',
      purpose: 'disclosure indicator',
    },
  ],
};
```

## Component Intent / Capability Coverage V1

`ComponentExpansionTarget` is the public pre-implementation authority for an
approved catalog target. Its versioned `intent` declares the reusable UI job,
shared semantic capabilities required on every target platform, and optional
platform-specific requirements.

```ts
const avatarTarget = {
  name: 'Avatar',
  layer: 'primitives',
  category: 'data-display',
  platforms: ['react', 'react-native'],
  profile: 'base',
  componentTokens: 'standard',
  role: 'foundational',
  intent: {
    schemaVersion: '1',
    job: 'Represent a person or entity with an image and deterministic fallback.',
    requiredCapabilities: [
      'image-source',
      'fallback',
      'size-variants',
      'accessible-name',
    ],
  },
};
```

`evaluateComponentIntentCoverage(target, metadata)` compares that approved
intent with implemented `ComponentMetadata` and returns one of:

- `satisfied`
- `partial`
- `missing`
- `unknown`

A component folder, generated scaffold, or matching name is not semantic
coverage. Missing, partial, or invalid/unknown intent evidence blocks canonical
completeness for tracked targets. Platform coverage is evaluated independently,
so a Web capability cannot silently satisfy a React Native requirement.

The production seed remains structural on purpose. Generator V2 may receive
the approved name/platform/layer/category/profile/token contract, but unresolved
semantic capabilities must be implemented and evidenced separately rather than
being copied from intent into metadata and self-certified.

## Validation

Use `validateComponentMetadata` when metadata comes from an unknown or
machine-readable source.

```ts
const result = validateComponentMetadata(input);

if (!result.valid) {
  console.error(result.errors);
}
```

Validation checks required fields, supported enum values, non-empty platform
lists, shared/platform capability evidence, duplicate entries, dependencies,
requirements, token requirements, and icon requirements.

## V1 boundaries

Component metadata V1 intentionally does not describe:

- full prop APIs
- every variant or size value
- Storybook story content
- website demos
- playground controls
- example source code
- generated API documentation
- Studio-specific metadata
- AI-specific instructions
- enterprise requirements

Those concerns belong to their own systems.

The V1 contract should stay small enough to remain stable and useful to
generators, completeness checks, CI, and maintenance tooling.
