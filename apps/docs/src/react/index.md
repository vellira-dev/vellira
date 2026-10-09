---
title: React Components
description: Learn how to use Vellira in React applications with installation, theming, accessibility, browser behavior, and production-ready components.
---

# React Components

`@vellira-ui/react` contains the React DOM implementation of Vellira.

It owns DOM structure, CSS modules, browser events, accessibility ids, and web overlay behavior while reusing shared tokens, types, and core hooks.

## Installation

```bash
pnpm add @vellira-ui/react
```

The package expects `react >=18.2 <20` and `react-dom >=18.2 <20`.

Import the stylesheet once in your application entry point.

```tsx
import '@vellira-ui/react/styles';
```

## Quick Example

```tsx
import { Button, Input, Select, Tabs } from '@vellira-ui/react';
import { useState } from 'react';

export function AccountPanel() {
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string | null>('editor');

  return (
    <Tabs defaultValue='profile'>
      <Tabs.List>
        <Tabs.Trigger value='profile'>Profile</Tabs.Trigger>
        <Tabs.Trigger value='security'>Security</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value='profile'>
        <Input
          label='Display name'
          value={displayName}
          onValueChange={setDisplayName}
          placeholder='Roman Bakurov'
        />

        <Select
          label='Role'
          value={role}
          onValueChange={setRole}
          placeholder='Choose role'
        >
          <Select.Item value='admin' label='Admin' />
          <Select.Item value='editor' label='Editor' />
          <Select.Item value='viewer' label='Viewer' />
        </Select>

        <Button color='primary' appearance='solid'>
          Save changes
        </Button>
      </Tabs.Content>

      <Tabs.Content value='security'>Security settings</Tabs.Content>
    </Tabs>
  );
}
```

## Component Library

<div class="docs-card-grid docs-card-grid-three">
  <a class="docs-card" href="/react/button">
    <strong>Button</strong>
    <span>Actions, loading states, icons, links, and destructive intent.</span>
  </a>

  <a class="docs-card" href="/react/input">
    <strong>Input</strong>
    <span>Text input, validation, formatting, masks, and adornments.</span>
  </a>

  <a class="docs-card" href="/react/checkbox">
    <strong>Checkbox</strong>
    <span>Boolean and mixed selection with labels and helper text.</span>
  </a>

  <a class="docs-card" href="/react/radio-group">
    <strong>RadioGroup</strong>
    <span>Visible mutually exclusive choices.</span>
  </a>

  <a class="docs-card" href="/react/select">
    <strong>Select</strong>
    <span>Single and multiple value selection.</span>
  </a>

  <a class="docs-card" href="/react/form-field">
    <strong>FormField</strong>
    <span>Shared labels, descriptions, messages, and validation layout.</span>
  </a>

  <a class="docs-card" href="/react/dropdown">
    <strong>Dropdown</strong>
    <span>Contextual actions, command menus, and rich menu items.</span>
  </a>

  <a class="docs-card" href="/react/tabs">
    <strong>Tabs</strong>
    <span>Organize related content with stable values and keyboard navigation.</span>
  </a>

  <a class="docs-card" href="/react/popover">
    <strong>Popover</strong>
    <span>Anchored interactive content with positioning and compound sections.</span>
  </a>

  <a class="docs-card" href="/react/tooltip">
    <strong>Tooltip</strong>
    <span>Short contextual helper text for compact controls.</span>
  </a>

  <a class="docs-card" href="/react/portal">
    <strong>Portal</strong>
    <span>Render overlays outside the normal DOM hierarchy.</span>
  </a>

  <a class="docs-card" href="/react/modal">
    <strong>Modal</strong>
    <span>Dialogs, confirmations, focus management, and blocking workflows.</span>
  </a>

  <a class="docs-card" href="/react/theme-provider">
    <strong>ThemeProvider</strong>
    <span>Light, dark, and high-contrast application themes.</span>
  </a>
</div>

## Available Components

Every public component exports TypeScript props from the package root. The generated reference lives in [`packages/react/API.md`](https://github.com/vellira-dev/vellira/blob/main/packages/react/API.md).

| Component       | Core API                                                                                 | State model                |
| --------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `Button`        | `appearance`, `color`, `shape`, icons, loading, links, DOM props                         | disabled or loading        |
| `Checkbox`      | `checked`, `defaultChecked`, `onCheckedChange`, label, description, error, indeterminate | controlled or uncontrolled |
| `Input`         | label, value, type, size, variant, validation, masks, formatting                         | controlled or uncontrolled |
| `FormField`     | label, description, messages, error, required, disabled, children                        | field composition          |
| `Radio`         | value, label, checked state, size, color, error, custom icon                             | controlled or uncontrolled |
| `RadioGroup`    | name, value, orientation, size, color, children                                          | controlled or uncontrolled |
| `Select`        | value, options, compound items, search, multiple selection, open state                   | controlled or uncontrolled |
| `Dropdown`      | compound menu sections, open state, placement, color, command behavior                   | controlled or uncontrolled |
| `Tabs`          | stable values, orientation, variants, mounting policy                                    | controlled or uncontrolled |
| `Popover`       | open state, positioning, alignment, offsets, compound sections                           | controlled or uncontrolled |
| `Tooltip`       | open state, placement, delay, trigger and content                                        | controlled or uncontrolled |
| `Portal`        | children, direct container, `PortalProvider`                                             | render target              |
| `Modal`         | open state, outside and Escape dismissal, compound dialog sections                       | controlled or uncontrolled |
| `ThemeProvider` | active theme, default theme, theme updates                                               | controlled or uncontrolled |

## API Conventions

### Controlled And Uncontrolled State

Components with user-owned state support controlled values.

```tsx
import { Checkbox, Select } from '@vellira-ui/react';
import { useState } from 'react';

export function ControlledSettings() {
  const [enabled, setEnabled] = useState(false);
  const [role, setRole] = useState<string | null>('editor');

  return (
    <>
      <Checkbox
        checked={enabled}
        onCheckedChange={setEnabled}
        label='Enable notifications'
      />

      <Select label='Role' value={role} onValueChange={setRole}>
        <Select.Item value='admin' label='Admin' />
        <Select.Item value='editor' label='Editor' />
        <Select.Item value='viewer' label='Viewer' />
      </Select>
    </>
  );
}
```

Use default props when the component can own its initial state.

```tsx
import { Checkbox, Radio, RadioGroup, Tabs } from '@vellira-ui/react';

export function UncontrolledPreferences() {
  return (
    <>
      <Checkbox defaultChecked label='Remember this device' />

      <RadioGroup name='theme' label='Theme' defaultValue='system'>
        <Radio value='system' label='System' />
        <Radio value='light' label='Light' />
        <Radio value='dark' label='Dark' />
      </RadioGroup>

      <Tabs defaultValue='profile'>
        <Tabs.List>
          <Tabs.Trigger value='profile'>Profile</Tabs.Trigger>
          <Tabs.Trigger value='security'>Security</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value='profile'>Profile settings</Tabs.Content>

        <Tabs.Content value='security'>Security settings</Tabs.Content>
      </Tabs>
    </>
  );
}
```

### DOM And Browser Props

Web components use browser-native props and events.

```tsx
<Button className='save-button' aria-label='Save project' onClick={saveProject}>
  Save
</Button>
```

Use `onClick`, `className`, and standard ARIA attributes in the React package. React Native uses platform-specific props such as `onPress`, `style`, and `accessibilityLabel`.

### Compound APIs

Overlay and navigation components expose compound sections.

```tsx
<Popover>
  <Popover.Trigger asChild>
    <Button>Open details</Button>
  </Popover.Trigger>

  <Portal>
    <Popover.Content>
      <Popover.Title>Project details</Popover.Title>
      <Popover.Description>
        Review metadata for the current project.
      </Popover.Description>
      <Popover.Close />
    </Popover.Content>
  </Portal>
</Popover>
```

Compound APIs keep semantic structure explicit while allowing custom layout and composition.

### Validation

Validation rules remain in the application.

```tsx
const emailError = email.includes('@') ? undefined : 'Enter a valid email.';

<Input
  label='Work email'
  type='email'
  value={email}
  onValueChange={setEmail}
  error={emailError}
/>;
```

Components render invalid state and connect supporting text, but they do not decide whether application data is valid.

## Accessibility

Vellira Web components implement browser-specific accessibility behavior.

- Use `aria-label` or `aria-labelledby` for icon-only or visually unlabeled controls.
- Input, Checkbox, Select, and RadioGroup connect labels, descriptions, required state, disabled state, and errors.
- FormField provides field layout for custom controls; the child still owns its ARIA attributes and interaction state.
- RadioGroup, Tabs, menus, tooltips, popovers, and modals provide role-appropriate keyboard behavior.
- Portal changes DOM placement but does not add semantics, labels, focus management, or dismissal behavior.
- Consumers remain responsible for meaningful copy, validation timing, post-submit focus, and product-specific announcements.

Test important workflows with keyboard navigation and browser screen readers.

## Theming

Import the stylesheet once for base component styles.

```tsx
import '@vellira-ui/react/styles';
import { ThemeProvider } from '@vellira-ui/react';

export function Root() {
  return (
    <ThemeProvider defaultTheme='light'>
      <App />
    </ThemeProvider>
  );
}
```

Theme values come from `@vellira-ui/tokens` and are exposed through CSS variables.

```css
.account-shell {
  color: var(--text-primary);
  background: var(--surface-default);
  border: 1px solid var(--border-default);
}
```

ThemeProvider supports light, dark, and high-contrast themes, plus controlled application-level switching.

## Storybook

Explore interactive states, accessibility behavior, and component composition in Storybook.

<a class="docs-cta" href="https://storybook.vellira.dev" target="_blank" rel="noreferrer">Open Storybook</a>

## Development

```bash
pnpm --filter @vellira-ui/react typecheck
pnpm --filter @vellira-ui/react build
pnpm --filter @vellira-ui/react test
pnpm --filter @vellira-ui/react-storybook dev
```

## Browser Support

Vellira targets modern evergreen browsers supported by React.

The package relies on standard browser APIs and does not require additional polyfills in modern environments.
