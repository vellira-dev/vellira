# Shadow and Elevation Architecture V1

Issue: #885

Vellira has one authored shadow/elevation design authority. Component contracts carry renderer-neutral shadow intent; Web and React Native output is derived after component-token resolution.

## Canonical authority

`packages/tokens/src/effects/shadow-system.ts` is the canonical structured source for shadow/elevation effects.

Each visual effect is represented as explicit layers with:

- x/y offset;
- blur;
- spread;
- color;
- opacity;
- inset state.

The canonical elevation roles are `sm`, `md`, `lg`, and `xl`. Inset and focus-ring effects use the same layer model. Multi-layer Light/Dark `lg` and `xl` effects therefore remain data rather than pre-composed CSS strings.

Theme variation belongs to the canonical effect role. Light, Dark, and High Contrast may resolve the same semantic role to different layer colors, opacities, or layer counts without creating separate renderer authorities.

## Web output

Web `box-shadow` values are serialized deterministically from canonical layers. The serializer owns CSS length formatting, RGBA conversion, spread emission, inset syntax, and multi-layer joining.

The existing public semantic surfaces remain compatible:

- `semantic.shadow.sm/md/lg/xl/inset`;
- `semantic.focus.ring.shadow`.

Those strings are derived output. They are no longer manually authored shadow design values.

## React Native output

The existing `tokens.shadows.sm/md/lg` objects remain as compatibility output, but their numeric values are derived from the canonical model rather than maintained as an independent shadow table.

React Native cannot reproduce every Web layer mathematically. Canonical elevation roles therefore carry explicit native approximation metadata. Current behavior is preserved:

- `sm`, `md`, and `lg` resolve to their historical native shadow/elevation objects;
- `xl` explicitly references the `lg` native approximation, preserving the historical Modal result without inventing a second `xl` design value.

The React Native package remains renderer-owned and does not import a private tokens-package adapter or unsupported package subpath. Its level-selection map is platform-output implementation policy only: it contains no shadow geometry or paint, and a cross-package architecture regression verifies that every selected level matches the canonical approximation metadata. This keeps the #884 package boundary without allowing the adapter policy to drift into a second authority.

## Component flow

The canonical flow is:

```text
structured shadow/elevation authority
             ↓
renderer-neutral component shadow intent
             ↓
        platform output
        /            \
 Web serializer    RN adapter
```

Tooltip, Popover, Modal, Dropdown, Select, ContextMenu, and component focus-ring consumers continue to use the renderer-neutral intents introduced by #884. No component owns a Web shadow string or React Native shadow object.

## Compatibility and preservation

This refactor is not a visual redesign. Existing public semantic/base paths are retained so #889 can own later public API/deprecation decisions. #880 preservation evidence and visual regression must remain unchanged for the final #885 HEAD.

A future change to an elevation role must change the canonical structured role first. Manually editing a semantic CSS shadow string or a separate native shadow value is an architecture violation.
