# @vellira-ui/tokens

Shared design tokens for Vellira.

This package is the single source of truth for primitive colors, semantic
tokens, component tokens, typography, spacing, radius, shadows, and z-index
values used by both the React and React Native packages.

## Installation

```bash
pnpm add @vellira-ui/tokens
```

## Features

- Shared design tokens
- Semantic color system
- Renderer-neutral theme objects
- Component-level tokens
- Generated CSS variables
- TypeScript-first API

## Usage

Choose a named theme explicitly:

```ts
import { darkTheme, highContrastTheme, lightTheme } from '@vellira-ui/tokens';

darkTheme.semantic.surface.default;
darkTheme.semantic.surface.panel;
darkTheme.semantic.text.primary;
darkTheme.semantic.border.default;
darkTheme.semantic.status.success.fg;

darkTheme.components.button.primary.solid.default.bg;
darkTheme.components.input.default.bg;

darkTheme.tokens.typography.family.regular;
darkTheme.tokens.spacing[4];
darkTheme.tokens.radius.md;

lightTheme.name; // 'light'
darkTheme.name; // 'dark'
highContrastTheme.name; // 'high-contrast'
```

There is no implicit current/default JavaScript theme object. The historical
`theme` export is a deprecated partial view of `darkTheme`; use `darkTheme`
directly. The compatibility export is scheduled for removal in Vellira 3.0.0.

The generated Web CSS separately uses Light values for `:root`, so pages without
a theme attribute have a deterministic browser fallback. That CSS default does
not make `lightTheme` an implicit JavaScript default.

## Semantic Tokens

The package provides semantic groups that describe intent instead of coupling
components to raw palette values.

Current semantic groups include:

- `action`
- `border`
- `control`
- `divider`
- `focus`
- `icons`
- `menu`
- `overlay`
- `shadow`
- `skeleton`
- `status`
- `surface`
- `text`

Example:

```ts
darkTheme.semantic.surface.canvas;
darkTheme.semantic.surface.panel;
darkTheme.semantic.surface.elevated;

darkTheme.semantic.text.primary;
darkTheme.semantic.text.secondary;

darkTheme.semantic.border.default;

darkTheme.semantic.status.success.fg;
darkTheme.semantic.status.error.fg;
```

`surface.canvas` is the application/root backdrop, `surface.panel` is bounded
neutral container/chrome, and `surface.elevated` is reserved for genuinely
raised or floating layers.

Using semantic tokens instead of raw palette values keeps component styling
consistent across renderers and themes.

## Component Tokens

Component tokens define renderer-neutral values for component states and
surfaces.

```ts
darkTheme.components.button.primary.solid.default.bg;
darkTheme.components.input.focus.border;
darkTheme.components.dropdown.content.bg;
darkTheme.components.popover.content.bg;
darkTheme.components.modal.content.bg;
darkTheme.components.tooltip.content.bg;
```

Color-like component tokens may use either colors or the literal `transparent`
when the intended rendered value is transparent.

## CSS Variables

Generated CSS variables are available for web projects:

```ts
import '@vellira-ui/tokens/css';
```

Examples:

```css
--color-mono-0
--surface-canvas
--surface-panel
--text-primary
--border-default
--button-primary-solid-default-bg
```

Canonical token-path types describe only the current renderer-neutral token
contract. During Vellira 2.x, a bounded set of legacy CSS variables is still
generated for migration compatibility. Those aliases remain in the generated
CSS-variable name unions because they are actually emitted, but they are not
canonical `TokenPath`/`ComponentTokenPath` entries and new code must not adopt
them.

The compatibility aliases, replacements, migration evidence, and removal
release are tracked in
`src/platform-output/component-token-web-compatibility.ts`. They are scheduled
for removal in Vellira 3.0.0.

## Public API deprecation policy

Public token/theme cleanup follows one bounded policy:

- named theme objects are canonical (`lightTheme`, `darkTheme`,
  `highContrastTheme`);
- deprecated root exports preserve their existing behavior during the 2.x
  compatibility window and name a canonical replacement;
- deprecated Web CSS variables remain platform-output aliases only and do not
  re-enter canonical token-path unions;
- every alias has migration/preservation evidence and an explicit removal
  boundary;
- Token Architecture Normalization V1 removes these compatibility aliases at
  Vellira 3.0.0 unless a separately reviewed policy revision supersedes it.

The machine-readable contract lives in `src/public-api-policy.ts`. The detailed
architecture note is `docs/architecture/token-public-api-v1.md`.

## React and React Native

The shared theme/token source is renderer-neutral. React/Web consumers can use
named theme objects or generated CSS variables. React Native consumes the same
canonical component intent and resolves platform representation through the
native output adapter; renderer-specific token branches are not part of the
public canonical component contract.

## Documentation

- [Design Tokens](https://docs.vellira.dev/design-system/tokens)
- [Theme Architecture](https://docs.vellira.dev/design-system/theme-architecture)
- [React](https://docs.vellira.dev/react/)
- [React Native](https://docs.vellira.dev/react-native/)

## Development

Build the package:

```bash
pnpm --filter @vellira-ui/tokens build
```

Token path unions, CSS variable name unions, and theme structure types are
generated from the token source files:

```bash
pnpm --filter @vellira-ui/tokens generate:types
```

Verify that generated token types are up to date:

```bash
pnpm --filter @vellira-ui/tokens generate:types:check
```

### Token preservation baseline

Token Architecture Normalization V1 uses a committed resolved-value baseline to
prevent naming and ownership cleanup from silently redesigning Vellira.

Verify the baseline with:

```bash
pnpm --filter @vellira-ui/tokens preservation:check
```

The preservation contract covers the complete current public visual surface:

- every resolved scalar leaf under the Light, Dark, and High Contrast theme
  graphs;
- shared public visual tokens exported outside those theme graphs, including
  overlay primitives and control-size values;
- generated Web CSS variable names together with their serialized values, using
  the same serializer as the published `@vellira-ui/tokens/css` artifact;
- the current React Native output contract derived from canonical component
  intents and platform adapters.

Normal token changes must not regenerate the baseline just to make a failure
disappear. Instead, record the change in
`src/preservation/token-migrations.ts` as an explicit rename, compatibility
alias, removal, addition, representation-only change, or approved visual
change. Renames and aliases are checked against the previous resolved identity,
so cleanup does not require obsolete token names to remain canonical forever.

Representation-only migrations explicitly declare their layer. A `canonical`
representation change is used when the renderer-neutral value changes shape or
type while retaining the same rendered meaning, for example a reviewed numeric
normalization such as `'1'` to `1`. A `platform-output` representation change
must additionally name the affected Web or React Native platform. Both forms
require explicit equivalence evidence; neither is an escape hatch for visual
drift.

`preservation:baseline` is a bootstrap command and refuses to overwrite an
existing committed baseline during normal work. A deliberate reviewed reset
requires the explicit `--force-reset` CLI flag. Resetting a baseline is never by
itself evidence that a visual change is safe.

Broad token migrations must also use the repository's canonical pinned Linux
visual regression path:

```bash
pnpm test:e2e:web:visual:docker
```

Do not update visual baselines or the token preservation baseline merely to
obtain green CI. Any intended visual change must be isolated and explicitly
approved.

## Principles

- Semantic tokens over hardcoded colors
- Shared across React and React Native
- Stable public API
- Predictable naming
- Theme-ready architecture
