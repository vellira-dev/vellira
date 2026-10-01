---
title: React Native Components
description: Build accessible iOS and Android interfaces with Vellira React Native components, shared tokens, controlled state, and native interaction patterns.
---

# React Native Components

`@vellira-ui/react-native` provides native components for iOS and Android with shared Vellira tokens, TypeScript contracts, and platform-appropriate interaction APIs.

## Installation

```bash
pnpm add @vellira-ui/react-native @react-native-picker/picker
```

The package expects `react >=19`, `react-native >=0.86`, and
`@react-native-picker/picker >=2` as peer dependencies.

## Components

<div class="docs-card-grid docs-card-grid-three">
  <a class="docs-card" href="/react-native/button"><strong>Button</strong><span>Pressable actions, loading, icons, badges, and semantic colors.</span></a>
  <a class="docs-card" href="/react-native/input"><strong>Input</strong><span>Native text input with validation, icons, masks, and clear actions.</span></a>
  <a class="docs-card" href="/react-native/checkbox"><strong>Checkbox</strong><span>Boolean and mixed selection with native accessibility.</span></a>
  <a class="docs-card" href="/react-native/radio-group"><strong>RadioGroup</strong><span>Visible single-selection groups with controlled state.</span></a>
  <a class="docs-card" href="/react-native/select"><strong>Select</strong><span>Sheet, modal, or popover selection for compact option lists.</span></a>
  <a class="docs-card" href="/react-native/form-field"><strong>FormField</strong><span>Presentational field layout for custom native controls.</span></a>
  <a class="docs-card" href="/react-native/dropdown"><strong>Dropdown</strong><span>Contextual native action menus.</span></a>
  <a class="docs-card" href="/react-native/tabs"><strong>Tabs</strong><span>Compound tab navigation for native screens.</span></a>
  <a class="docs-card" href="/react-native/popover"><strong>Popover</strong><span>Anchored interactive content with native positioning and compound sections.</span></a>
  <a class="docs-card" href="/react-native/tooltip"><strong>Tooltip</strong><span>Floating helper text around native targets.</span></a>
  <a class="docs-card" href="/react-native/portal"><strong>Portal</strong><span>Shared primitive for explicit overlay composition.</span></a>
  <a class="docs-card" href="/react-native/modal"><strong>Modal</strong><span>Compound native dialogs with overlays and actions.</span></a>
  <a class="docs-card" href="/react-native/theme-provider"><strong>ThemeProvider</strong><span>Light, dark, and high-contrast native themes.</span></a>
</div>

## Basic Example

```tsx
import { Button, Checkbox, Input } from '@vellira-ui/react-native';
import { useState } from 'react';
import { View } from 'react-native';

export function Example() {
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  return (
    <View style={{ gap: 16 }}>
      <Input label='Email' value={email} onValueChange={setEmail} />

      <Checkbox
        label='Accept terms'
        description='Required to create an account.'
        checked={accepted}
        onCheckedChange={setAccepted}
      />

      <Button onPress={() => submit({ email, accepted })}>Continue</Button>
    </View>
  );
}
```

## Native API Conventions

- Use `onPress` for actions.
- Use `style`, `textStyle`, `inputStyle`, and other React Native style props.
- Use `accessibilityLabel` for icon-only or visually unlabeled controls.
- Controlled components expose `value` or `checked`; uncontrolled components use `defaultValue` or `defaultChecked`.
- Validation belongs to the app. Components render `error` and `invalid` states.
- Verify important flows with iOS VoiceOver and Android TalkBack on real devices.

## Development

```bash
pnpm --filter @vellira-ui/react-native build
pnpm --filter @vellira-ui/react-native test
pnpm --filter native-storybook start
```
