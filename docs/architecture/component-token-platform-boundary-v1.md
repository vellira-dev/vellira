# Component Token Platform Boundary V1

Issue: #884

Vellira component tokens are canonical renderer-neutral contracts. Web and React Native representation is produced only after canonical component-token resolution.

## Canonical component tokens may contain

- semantic colors and visual states;
- spacing, size, radius, geometry and motion intent;
- renderer-neutral effect intent such as a shadow level;
- renderer-neutral viewport/layout intent such as a viewport-height ratio;
- component semantics that have the same meaning on Web and React Native.

## Canonical component tokens must not contain

- `web` or `native` branches;
- names such as `nativeMaxHeight` or other renderer implementation keys;
- CSS-only values when the same intent needs a different React Native representation;
- React Native shadow/style objects embedded beside Web representations;
- duplicated renderer-specific values for one component semantic.

## Platform-output stage

Renderer-specific serialization happens after the canonical component contract is resolved.

Examples:

- canonical `{ kind: 'shadow', level: 'lg' }` becomes the current Web shadow string for Web output and a structured React Native shadow for RN output;
- canonical `{ kind: 'viewport-height', ratio: 0.9 }` becomes `90vh` for Web and `90%` for React Native.

The canonical component path remains component-semantic (`content.shadow`, `content.maxHeight`). The adapter owns representation.

Platform adapters are renderer-owned implementation details, not part of the supported `@vellira-ui/tokens` public API. The tokens package owns canonical intent construction, validation and Web token serialization. The React Native package owns its runtime Web/native adaptation from the same canonical theme contract. Neither renderer may introduce a second authored design value to perform that adaptation.

Shadow/elevation design values are now owned by the structured #885 authority in `packages/tokens/src/effects/shadow-system.ts`. `semantic.shadow.*`, `semantic.focus.ring.shadow`, and `tokens.shadows.*` are derived compatibility outputs, not parallel design sources. Native approximation is explicit platform-output policy; it may select a canonical approximation but may not author replacement geometry or paint.

## Generator rule

Generator V2 must emit renderer-neutral component-token contracts by default. Generated canonical contracts must not introduce `web`, `native`, `native*`, CSS-only shadow strings, or React Native style-object branches. Platform differences belong in platform-output adapters.

## Validation

The token architecture must provide a deterministic leakage check over every `theme.components.*` family. Known renderer-key patterns are rejected fail-closed. Representation-specific values must be wrapped in an approved renderer-neutral intent and resolved by the platform-output layer.

#884 established the renderer-neutral component boundary. #885 completes the underlying effect ownership: component shadow intent now resolves from one structured shadow/elevation authority instead of independent Web and native design tables.
