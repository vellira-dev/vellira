# @vellira-ui/react-native

React Native implementation of the Vellira design system.

It extends shared contracts from `@vellira-ui/types`, uses shared tokens from
`@vellira-ui/tokens`, shares renderer-neutral behavior through
`@vellira-ui/core`, and keeps native rendering, accessibility, layout, and
interaction behavior inside the React Native layer.

## Installation

Requires `react >=19`, `react-native >=0.86`,
`@react-native-picker/picker >=2`, and `react-native-svg >=13`.

```bash
pnpm add @vellira-ui/react-native @react-native-picker/picker react-native-svg
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
