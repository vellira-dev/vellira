# Token Semantic Vocabulary V1

## Status

Canonical semantic naming contract for Vellira token consumers, Generator V2, quality tooling, and agents. The machine-readable authority lives in `packages/tokens/src/token-architecture.ts` as `semanticVocabularyV1` and `canonicalSemanticRolePaths`.

## Rule

Semantic names describe **purpose**, not a primitive hue, renderer, interaction implementation, or the component that first introduced the value. Primitive values feed semantic roles; component factories consume semantic roles; platform adapters serialize component contracts. Consumers select semantic roles by purpose, never by whichever role currently resolves to a matching primitive value.

## Canonical namespaces

- **surface** — canvas/layer backgrounds and generic interaction surfaces. `surface.canvas` is the application/page root backdrop; `surface.panel` is bounded neutral container/chrome that sits on the canvas without implying floating elevation; `surface.elevated` remains for raised/floating layers. `surface.background` stays removed because it mixed those purposes under one ambiguous name.
- **text** — foreground hierarchy (`primary → secondary → muted → subtle → disabled`) plus brand and interaction-specific text roles.
- **icons** — icon foreground hierarchy. `interactive`/`interactiveHover` describe interaction; `brand` remains a distinct identity role.
- **border / divider** — structural borders and separators. `border.interactive` is generic interaction emphasis; actual focus indication belongs to `focus.ring`.
- **focus** — focus indication only. `ring.offsetColor` is explicitly a color, not geometric spacing. The focus-ring shadow is derived from the shared structured effect authority rather than authored as a CSS-only value.
- **status** — success/error/warning/info paint with explicit `fg`, `bg`, `border`, `ring`, and `emphasisFg` consumption roles.
- **action** — reusable action palettes. `primary` is the main brand action, `accent` is the cyan secondary-brand hue, `neutral` is non-brand action chrome, and `danger` is destructive action paint.
- **control** — generic form-control state paint using the canonical interaction vocabulary from #882.
- **menu** — menu-specific current/highlighted semantics where `active` is a real persistent/current domain state.
- **overlay** — `backdrop`, `tooltip`, `floating`, and `dialog`; names describe presentation purpose rather than Popover/Modal component history.
- **shadow** — semantic elevation references (`sm`, `md`, `lg`, `xl`) plus `inset`. Their public CSS strings are derived from the canonical structured #885 shadow/elevation model; they are not an independent Web design authority.

## Surface ownership correction

The original #883 source audit missed authored CSS consumers of generated `--surface-background`. Those consumers showed that the removed role had been serving two different purposes. Application roots stay on `surface.canvas`; bounded sidebars, navigation drawers, cards, code panels, and similar chrome use `surface.panel`. Foreground paint must use foreground roles such as `text.inverse`, never a surface token.

`surface.panel` preserves the former bounded-container values without changing `canvas` or abusing `elevated` as a value-matching alias:

- Light: `colors.mono[50]`
- Dark: `colors.vellira[950]`
- High Contrast: `colors.grayBlue[950]`

## Migration policy

Legacy public names are tracked through the #880 preservation manifest. Renames are baseline-to-final: migration metadata never preserves intermediate historical names as permanent vocabulary. Pure renames preserve resolved values. The only visual corrections in #883 remain inside existing Vellira palettes and require explicit preservation evidence plus pinned visual regression.

## Theme hierarchy corrections

Semantic roles stay distinct even when a theme resolves some of them to equal values. V1 also corrects three pre-existing mapping errors without introducing new colors: Dark text `muted/subtle` ordering, High Contrast icon `muted/subtle` ordering, and Dark warning/info focus-ring palettes.
