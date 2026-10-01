# @vellira-ui/react

React implementation of the Vellira design system.

It extends shared contracts from `@vellira-ui/types`, uses shared tokens from
`@vellira-ui/tokens`, shares renderer-neutral behavior through
`@vellira-ui/core`, and keeps DOM rendering, CSS, accessibility, and browser
interaction behavior inside the web layer.

## Installation

Requires React and React DOM `>=18.2 <20`.

```bash
pnpm add @vellira-ui/react
```

## Usage

Import the stylesheet once in your app entry point:

```tsx
import '@vellira-ui/react/styles';
```

Then use the components:

```tsx
import { Button, Checkbox, Input } from '@vellira-ui/react';
import { useState } from 'react';

export function Example() {
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  return (
    <form>
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
        Submit
      </Button>
    </form>
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

Every public component includes Storybook stories and Vitest unit tests.

For detailed props, shared types, examples, and compound component APIs, see
[Web Component API](./API.md).

## Infrastructure

The package also exports web infrastructure used by components and
applications:

- `Portal`
- `PortalProvider`
- `ThemeProvider`
- `useTheme`

## Documentation

- [Getting Started](https://docs.vellira.dev/start/getting-started)
- [React](https://docs.vellira.dev/react/)
- [Web Component API](./API.md)

## Storybook

Explore every component in
[Storybook](https://storybook.vellira.dev/).

## Development

```bash
pnpm --filter @vellira-ui/react build
pnpm --filter @vellira-ui/react test
```
