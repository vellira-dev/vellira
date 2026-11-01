# @vellira-ui/react-native

React Native implementation of the Vellira design system.

It extends shared contracts from `@vellira-ui/types`, uses shared tokens from
`@vellira-ui/tokens`, shares renderer-neutral behavior through
`@vellira-ui/core`, and keeps native rendering, accessibility, layout, and
interaction behavior inside the React Native layer.

## Installation

Requires `react >=19`, `react-native >=0.86`, and `react-native-svg >=13`.
Picker is not required by Vellira's native Select.

```bash
pnpm add @vellira-ui/react-native react-native-svg
```

## Usage

Use the components directly in your React Native application:

```tsx
import { Button, Checkbox, Input } from '@vellira-ui/react-native';
import { useState } from 'react';
import { View } from 'react-native';

export function Example() {
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  return (
    <View style={{ gap: 16 }}>
      <Input
        label='Email'
        value={email}
        onValueChange={setEmail}
        placeholder='name@example.com'
      />
      <Checkbox
        label='Accept terms'
        description='Required to create an account.'
        checked={accepted}
        onCheckedChange={setAccepted}
      />
      <Button color='primary' appearance='solid'>
        Continue
      </Button>
    </View>
  );
}
```

## Smaller native bundles — shared component entrypoints (opt-in)

For apps that use only a subset of Vellira Native components, prefer **leaf
imports**. Each public entry shares the **same compiled runtime graph** as the
legacy root, including one ThemeContext and common utility modules:

```tsx
import { Button } from '@vellira-ui/react-native/button';
import { Select } from '@vellira-ui/react-native/select';
import { ThemeProvider, useTheme } from '@vellira-ui/react-native/theme';
```

The existing `import { Button, Select } from '@vellira-ui/react-native'`
remains supported and is the compatibility default. It may include the whole
public component graph in Metro even if the app uses one component; switching to
a leaf import is **explicit**. The complete list of subpaths is maintained in
`packages/react-native/native-subpaths.json` (e.g. `/input`, `/checkbox`,
`/radio-group`, `/dropdown`, `/modal`, `/form-field`, `/portal`).

Do not mix packages from different Vellira versions. Using root and leaf imports
from the **same installed version** is supported by the shared-graph build, but
the root itself may defeat the size saving. Prefer leaf imports consistently in
small apps. This optimization does **not** split the native app binary, create
runtime lazy loading, or reduce the cost of React Native and Expo themselves.

Measure actual iOS/Android production Metro exports of your own app before
claiming a specific byte saving; emitted JS is not equivalent to on-device
memory, install size, or startup latency. Do not import unpublished `dist/`
files or rely on test-only experimental subpath probes.

## Components

### Inputs

- Button
- Checkbox
- Input
- Radio
- RadioGroup
- Select

### Overlays

- Dropdown
- Tooltip
- Popover
- Modal

### Forms

- FormField
- Tabs

Every public component includes React Native Storybook stories and Vitest unit
tests.

For detailed props, shared types, examples, and compound component APIs, see
[Native Component API](./API.md).

## Infrastructure

The package also exports native infrastructure used by components and
applications:

- `Portal`
- `PortalProvider`
- `ThemeProvider`
- `useTheme`
- `nativeThemes`

## Documentation

- [Getting Started](https://docs.vellira.dev/start/getting-started)
- [React Native](https://docs.vellira.dev/react-native/)
- [Native Component API](./API.md)

## Storybook

Native stories live next to components as `*.stories.tsx` and are consumed by
`apps/native-storybook`.

Run on-device Storybook from the workspace root:

```bash
pnpm --filter native-storybook start
pnpm --filter native-storybook ios
pnpm --filter native-storybook android
```

## Development

```bash
pnpm --filter @vellira-ui/react-native build
pnpm --filter @vellira-ui/react-native test
```

Run the Expo playground:

```bash
pnpm --filter native-playground start
```
