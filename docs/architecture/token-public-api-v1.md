# Token Public API and Deprecation Policy V1

Issue: #889

## Public theme contract

`@vellira-ui/tokens` has three canonical named theme exports:

- `lightTheme` with `name === 'light'`;
- `darkTheme` with `name === 'dark'`;
- `highContrastTheme` with `name === 'high-contrast'`.

There is no implicit current/default theme export. Consumers that need a concrete
object choose one of the named themes explicitly. The string form
`high-contrast` is the serialized theme identity; the camel-cased
`highContrastTheme` identifier is the TypeScript export name.

The generated Web CSS has a separate, explicit browser default: Light values are
emitted for `:root` as well as the `light` data-theme selectors. This CSS fallback
does not make `lightTheme` an implicit JavaScript default and does not justify a
generic `theme` export.

The historical root export `theme` is not a default theme. It is a partial view
of `darkTheme` containing only `semantic`, `components`, and `tokens`. It remains
available only as a deprecated 2.x compatibility export and is scheduled for
removal in Vellira 3.0.0. New code must import `darkTheme` directly when it
actually intends to use Dark theme values.

## Canonical token paths

`TokenPath`, `SemanticTokenPath`, and `ComponentTokenPath` are generated only
from canonical runtime theme graphs. A compatibility alias must not be added
back to those unions merely to preserve an old public spelling.

This distinction is intentional: canonical path types describe the current
design contract, while compatibility output exists only at the package/platform
boundary.

## Generated CSS variables

`@vellira-ui/tokens/css` publishes generated variables from the canonical theme
and component output. During the 2.x migration window, a small set of legacy Web
variables retained by #884 is also emitted so existing consumers do not break
silently.

Every such alias is listed in
`src/platform-output/component-token-web-compatibility.ts` with:

- its legacy token path and CSS variable;
- the canonical replacement path and CSS variable;
- the preservation/migration evidence that explains why it exists;
- the #889 ownership marker;
- the removal release (`3.0.0`).

Legacy variables remain part of the generated CSS-variable name unions while
they are actually emitted. They are deliberately excluded from canonical token
path unions.

The old Popover `shadow.native.*` CSS variables were renderer-leakage identities,
not canonical Web design roles. Web consumers should migrate to
`--popover-content-shadow`. Native consumers should use the React Native output
of the renderer-neutral Popover shadow intent rather than depending on Web CSS
variables.

## Deprecation rules

A compatibility alias is allowed only when all of the following are true:

1. the current canonical replacement is named;
2. migration/preservation evidence is linked;
3. runtime/output behavior remains stable for the compatibility window;
4. documentation tells new consumers not to adopt the alias;
5. a removal boundary is explicit.

Token Architecture Normalization V1 uses Vellira 3.0.0 as that removal boundary.
Aliases are not permanent API synonyms. Extending one beyond that boundary
requires a separately reviewed policy revision rather than silently carrying it
forward.

## React and React Native consumption

Theme/token source remains shared and renderer-neutral. React/Web consumers use
named theme objects or the generated CSS output. React Native resolves component
platform intents through its native output adapter. Renderer-specific storage
must not be reintroduced into canonical component tokens for compatibility.

## Validation

`public-api-v1.test.ts` locks:

- named export ↔ runtime `theme.name` agreement;
- Light as the generated CSS `:root` default without defining a JavaScript default;
- the exact historical `theme` compatibility shape and its source deprecation;
- migration evidence for every generated Web compatibility alias;
- exclusion of legacy aliases from canonical component token paths;
- inclusion of emitted legacy variables in generated CSS-variable unions;
- the common 3.0.0 removal boundary.

#890 should consume these machine-readable contracts rather than recreating a
second public-API/deprecation vocabulary.
