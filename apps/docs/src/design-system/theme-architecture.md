---
title: Design Token Architecture
description: Learn how Vellira organizes primitive colors, semantic tokens, component tokens, and platform-specific themes.
---

# Token Architecture

Vellira separates design decisions into layers. Each layer has one owner and one
reason to change. A token should be chosen by semantic purpose, not by inspecting
raw palette colors.

```text
Primitive values
        │
        ▼
Semantic tokens
        │
        ▼
Component token factories
        │
        ▼
Component tokens
        │
        ▼
Platform and theme output
        │
        ▼
Consumers
```

Architecture-only token work must preserve the recognizable Vellira appearance.
Renaming, moving, or serializing a token must not silently recolor React, React
Native, website, docs, Storybook, or generated outputs. If an existing visual
mapping is wrong, record it and handle it in a focused visual issue.

The machine-readable contract lives in `packages/tokens/src/token-architecture.ts`.

## Primitive Tokens

Primitive tokens define raw design values only:

- color palettes and scales;
- spacing;
- radius;
- sizing;
- typography scales;
- shadows;
- z-index values;
- platform-neutral implementation primitives such as transparent paint.

Primitive values are useful inside the token package, but product code should
rarely depend on them directly.

```ts
import { theme } from '@vellira-ui/tokens';

theme.colors.primary[500];
theme.colors.vellira[950];
theme.colors.success[600];
```

Use primitives directly only when authoring token definitions, documenting raw
palette values, or building a visual palette/reference tool. Consumers should
not choose primitives because a color "looks right".

## Semantic Tokens

Semantic tokens translate palettes into UI meaning. Instead of asking for
`primary.500` or `vellira.950`, components and applications ask for concepts
such as surface, text, border, focus, and status.

```ts
theme.semantic.surface.default;
theme.semantic.text.primary;
theme.semantic.border.default;
theme.semantic.status.success.fg;
```

This layer isolates design decisions from implementation details.

Canonical semantic groups include:

| Group        | Purpose                                                         |
| ------------ | --------------------------------------------------------------- |
| `surface`    | Containers, page backgrounds, elevated planes, interactive fill |
| `text`       | Content hierarchy and interactive foregrounds                   |
| `border`     | Control and container boundaries                                |
| `divider`    | Separators that are not full component borders                  |
| `focus`      | Keyboard and programmatic focus indicators                      |
| `status`     | Success, error, warning, and info roles                         |
| `overlay`    | Backdrop, tooltip, popover, and modal surfaces                  |
| `navigation` | Navigation-specific interaction roles                           |
| `menu`       | Menu item and danger item roles                                 |

### Surface Vocabulary

`surface.canvas` is the outer page or app canvas. `surface.default` is the
normal content surface. `surface.subtle` and `surface.muted` are lower-emphasis
planes. `surface.elevated` is used for raised content such as popovers, cards,
and dialogs. `surface.hover`, `surface.active`, and `surface.pressed` are
interactive state surfaces. `surface.disabled`, `surface.danger`, and
`surface.inverse` are reserved roles.

Do not infer semantic strength from numeric lightness alone. The hierarchy must
make sense independently in light, dark, and high-contrast themes.

### Text And Foreground Vocabulary

Use `text.primary`, `text.secondary`, `text.muted`, and `text.subtle` for
content hierarchy. Use `text.disabled` only for disabled content, `text.inverse`
only on inverse surfaces, and `text.brand` for brand emphasis.

Use `text.interactive`, `text.interactiveHover`, and `text.interactiveActive`
for interactive labels and icons when a component token does not already define
the state.

`foreground`, `fg`, and `icon` are implementation keys inside component tokens.
Semantic token names use `text` for shared foreground roles.

### Border And Divider Vocabulary

Use `border.subtle`, `border.muted`, `border.default`, and `border.strong` for
boundary emphasis. `border.elevated` and `border.disabled` are reserved for
elevated and disabled contracts. `divider.muted`, `divider.default`, and
`divider.strong` are for separators.

Do not apply one universal contrast threshold to every decorative border.
Contrast checks are role-specific.

## Component Tokens

Component tokens turn semantic decisions into stable component states. Components
should not depend on palette values directly. They consume semantic and component
tokens that describe UI states.

```ts
theme.components.button.primary.solid.default.bg;
theme.components.button.primary.solid.hover.bg;
theme.components.input.focus.border;
theme.components.dropdown.content.bg;
```

Component tokens keep renderer implementations aligned across Web and React
Native.

Create component tokens only when generic semantic roles are insufficient for a
stable component contract. Do not create component-specific aliases for every
generic semantic token.

### Component Factories

Component token factories are a first-class architecture layer:

```text
primitive values
        │
        ▼
semantic roles
        │
        ▼
factory inputs
        │
        ▼
factory defaults and fallbacks
        │
        ▼
per-theme component token materialization
        │
        ▼
generated CSS and JS output
        │
        ▼
React and React Native consumers
```

Factories compose canonical semantic inputs and stable implementation primitives
into a component contract. They must not become a second semantic-token system.

Use `create<Component>Tokens` for factories that produce a component contract.
Existing `create<Component>Palette` names are retained when the component exposes
intent palettes such as primary, neutral, success, warning, and danger. Rename
only with compatibility and a documented migration.

Factory state keys must use the canonical state vocabulary: `default`, `hover`,
`active`, `pressed`, `selected`, `disabled`, and `focus`. Component-specific
states are allowed only when the component contract requires them. For example,
Accordion may expose `expanded`, but it maps semantically to selected state.

Factory fallbacks must be intentional. A fallback from pressed border to default
border, or from selected pressed background to selected background, is acceptable
only when the collapse preserves the component's current visual contract.

When Generator V2 creates a component, it should:

1. reuse an existing factory pattern when the state vocabulary matches;
2. extend a reusable factory only when the shared contract genuinely needs a new
   stable state;
3. introduce a new component-specific factory only when generic semantic roles
   cannot express the component contract.

## Renderer Components

Renderer packages consume the token layers and expose stable components.

| Renderer | Package                    | Responsibility                   |
| -------- | -------------------------- | -------------------------------- |
| Web      | `@vellira-ui/react`        | React components for the browser |
| Native   | `@vellira-ui/react-native` | React Native components          |

The components should depend on semantic and component tokens, not on raw
palette decisions. This keeps visual changes centralized inside the token
system.

Web and React Native should consume equivalent semantic or component intent when
the concept is shared. Web-only and native-only tokens are allowed when the
platform semantics differ, but serialization must not silently rename or flatten
semantic identity.

CSS custom properties and JS/TS token identities are both generated from the
same theme objects. A component token such as
`theme.components.button.primary.solid.hover.bg` must correspond predictably to
its CSS variable.

## Theme Parity

Light, dark, and high-contrast themes must expose the same semantic and component
token shapes unless a platform-specific contract explicitly says otherwise.

High contrast is not a copied dark theme. It may intentionally map roles to
different primitive scales to preserve boundaries, focus visibility, and text
contrast. Identical raw values for two semantic roles are allowed only when the
semantic collapse is intentional.

## Renames And Deprecation

Do not perform blind mass renames. If a public token name no longer matches its
semantics:

1. introduce the canonical replacement;
2. keep the old name compatible when public consumers may depend on it;
3. migrate first-party consumers deliberately;
4. document the deprecation and migration;
5. remove the old name only when safe and explicitly justified.

## Why This Shape

This architecture gives Vellira three useful properties:

- product code reads in design-system language;
- renderer packages stay visually consistent;
- token changes can be made without rewriting component APIs.

When introducing a new design decision, add it at the lowest appropriate layer.

Use primitive colors for palettes, semantic tokens for reusable UI meaning,
and component tokens for component-specific states.

## Audit Findings

The current architecture audit classifies findings with these labels:

| Label | Meaning                                       |
| ----- | --------------------------------------------- |
| A     | Correct architecture or usage                 |
| B     | Consumer uses the wrong semantic token        |
| C     | Missing reusable semantic role                |
| D     | Redundant, ambiguous, or misnamed token       |
| E     | Legitimate component-specific token           |
| F     | Hardcoded or noncanonical value               |
| G     | Intentional platform or theme difference      |
| H     | Visual correction needed outside architecture |

Findings that would visibly change website or component output are recorded as
outside this architecture task unless an explicit visual/design issue authorizes
the change.

## Design Flow

When creating a new component, the recommended flow is:

1. Define or reuse primitive colors.
2. Create semantic meanings where needed.
3. Map semantics to component tokens.
4. Build renderer-specific implementations.
5. Expose a stable public API.
