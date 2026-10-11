# @vellira-ui/icons

Shared icon package for Vellira.

Provides static icons for React and React Native together with animated icon
assets. Platform-specific implementations are selected automatically through
package export conditions, with explicit web and native entry points available
when needed.

## Installation

```bash
pnpm add @vellira-ui/icons
```

## Usage

Use the platform-aware default entry point in React applications:

```tsx
import { Search, Settings, User } from '@vellira-ui/icons';

export function Example() {
  return <Search />;
}
```

React Native consumers use the same public imports:

```tsx
import { Search } from '@vellira-ui/icons';

export function Example() {
  return <Search />;
}
```

## Entry Points

- `@vellira-ui/icons` — platform-aware default entry
- `@vellira-ui/icons/web` — explicit web icon entry
- `@vellira-ui/icons/native` — explicit React Native icon entry
- `@vellira-ui/icons/lottie` — animated icon data and manifest

## Documentation

- [Icons](https://docs.vellira.dev/icons/)
- [Static Icons](https://docs.vellira.dev/icons/static)
- [Animated Icons](https://docs.vellira.dev/icons/animated)
- [Icon Usage](https://docs.vellira.dev/icons/usage)

## Development

Generate icons:

```bash
pnpm --filter @vellira-ui/icons generate
```

Build the package:

```bash
pnpm --filter @vellira-ui/icons build
```

Generated source files live in `src/generated/` and publishable artifacts are
emitted to `dist`.

## Package Structure

```text
svg/
src/
├── generated/
├── web.ts
├── native.ts
└── lottie.ts
```

Source SVG assets live in `svg/`. Generated icon implementations should not be
edited manually.

## Legacy brand exports

`GitHub`, `Facebook`, `LinkedIn`, `Reddit`, `X`, and `Storybook` are legacy
third-party brand exports retained for public 2.x API compatibility. They are
deprecated for new first-party use and are no longer advertised by the ordinary
Icons catalog. Removal requires an explicitly planned breaking release; the
normal web/native generator and export contract remain intact.

Website branding belongs to `apps/website/brand`, not this cross-platform UI
vocabulary. Official provider web artwork must never be passed through this
package's React Native conversion. `DocsVellira` remains a Vellira-owned product
mark and public export; it is documented under Product assets/Vellira.
