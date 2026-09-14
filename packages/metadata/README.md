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
    'keyboard',
    'focus-management',
    'compound-api',
    'portal',
  ],

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

Important behavior that tooling may use when generating or validating a
component.

V1 capabilities include:

- `controlled`
- `uncontrolled`
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

Capabilities should describe meaningful engineering behavior.

Do not add every prop, visual variant, event, or implementation detail as a
capability.

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
lists, duplicate entries, dependencies, requirements, token requirements, and
icon requirements.

## V1 boundaries

Component metadata V1 intentionally does not describe:

- full prop APIs
- variants and sizes
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
