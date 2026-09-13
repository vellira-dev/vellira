# Component Page Generator

Builds website component catalog pages under
`apps/website/src/component-catalog`.

## Commands

```bash
pnpm create:component-page <Name> [--force] [--check]
pnpm create:component-page --help
pnpm component-pages:generate
pnpm component-pages:audit
pnpm component-pages:audit --component Button
pnpm component-pages:check
pnpm test:component-page-generator
pnpm test:component-pages
```

The no-argument audit remains the complete catalog check used by normal CI.
`--component <Name>` scopes expensive source/model and generated-file checks to
one canonical name from the discovered inventory. Shared registry relationships
are still validated globally. Unknown names, malformed flags, and empty
inventories fail rather than producing a partial or zero-component success.
A focused pass is not evidence that the complete catalog has passed.

## Pipeline

The generator keeps page generation convention-first:

```txt
source extraction
  -> profile conventions
  -> optional colocated metadata
  -> GeneratedPageModel
  -> renderers
  -> audit/check
```

Source facts such as props, types, JSDoc, defaults, platform support, and
owned/inherited API classification come from package source wherever possible.
Metadata files under `apps/website/src/component-catalog/components/<Component>/`
are optional and should only provide curated information that cannot be inferred
reliably, such as examples, related components, accessibility guidance, or
compound API section ordering.

## Boundaries

This subsystem may inspect runtime package source, but it should not import the
component scaffolding generator implementation. Renderers should consume the
normalized model rather than re-extracting source facts.

## Modules

- `create-component-page.ts` is the CLI/orchestrator.
- `extractors/` reads package source and TypeScript public props.
- `model/` resolves page input and builds `GeneratedPageModel`.
- `metadata/` loads and merges optional colocated component metadata.
- `profiles/` provides reusable convention defaults.
- `renderers/` turns the normalized model and derived artifacts into generated
  website files and registry updates.
- `helpers/` contains component-page-only formatting, paths, and file writing.

## Intentional React / React Native API differences

Platform parity means equivalent user-facing capability where appropriate,
not identical prop surfaces.

Examples:

- DOM events (`onClick`, keyboard events) remain React-specific.
- Native interaction events use `onPress`, `onLayout`, and native accessibility props.
- Web-only overlay positioning/focus props are not exposed on React Native when unsupported.
- React Native presentation/virtualization props remain native-specific where the platform requires them.
- Platform-specific props must not appear in generated demos, usage code, examples, API sections, or playground controls for unsupported platforms.
