---
title: Getting Started with Vellira
description: Learn how to install Vellira, set up React or React Native, import styles, and build your first interface with accessible UI components.
---

# Quick Start

Get from installation to your first Vellira component in a few minutes.

## 1. Install a Renderer

Choose the package for your application.

::: code-group

```bash [React]
pnpm add @vellira-ui/react
```

```bash [React Native]
pnpm add @vellira-ui/react-native @react-native-picker/picker
```

:::

React web apps must satisfy `react >=18.2 <20` and
`react-dom >=18.2 <20`. React Native apps must satisfy `react >=19`,
`react-native >=0.86`, and `@react-native-picker/picker >=2`. The install
command above includes the non-framework native peer so a clean project does not
start with missing-peer setup.

Add optional packages when you need icons or direct access to design tokens.

::: code-group

```bash [Icons]
pnpm add @vellira-ui/icons
```

```bash [Tokens]
pnpm add @vellira-ui/tokens
```

:::

## 2. Add React Styles

React web applications should import the Vellira stylesheet once in the
application entry point.

```tsx
import '@vellira-ui/react/styles';
```

React Native apps do not need a stylesheet import. Native components use React
Native styles and shared theme values internally.

## 3. Render Your First Component

### React

```tsx
import '@vellira-ui/react/styles';

import { Button, Checkbox, Input } from '@vellira-ui/react';
import { useState } from 'react';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(false);

  return (
    <form>
      <Input
        label='Email'
        value={email}
        onValueChange={setEmail}
        placeholder='name@example.com'
      />
      <Checkbox
        label='Remember me'
        description='Keep this browser signed in.'
        checked={remember}
        onCheckedChange={setRemember}
      />
      <Button color='primary' appearance='solid'>
        Continue
      </Button>
    </form>
  );
}
```

### React Native

```tsx
import { Button, Checkbox, Input } from '@vellira-ui/react-native';
import { useState } from 'react';
import { View } from 'react-native';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(false);

  return (
    <View style={{ gap: 16, padding: 24 }}>
      <Input label='Email' value={email} onValueChange={setEmail} />
      <Checkbox
        label='Remember me'
        description='Keep this device signed in.'
        checked={remember}
        onCheckedChange={setRemember}
      />
      <Button color='primary' appearance='solid'>
        Continue
      </Button>
    </View>
  );
}
```

## 4. Continue Exploring

| Goal                       | Next page                                               |
| -------------------------- | ------------------------------------------------------- |
| Explore component patterns | [Component Overview](/start/component-overview)         |
| Build with React           | [React](/react/)                                        |
| Build with React Native    | [React Native](/react-native/)                          |
| Use icons                  | [Icons](/icons/)                                        |
| Understand theming         | [Theme Architecture](/design-system/theme-architecture) |
| Work with tokens directly  | [Design Tokens](/design-system/tokens)                  |

## Repository Development

Run the documentation site from the repository root:

```bash
pnpm docs:dev
```

Build it the same way CI does:

```bash
pnpm docs:build
```
