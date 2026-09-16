---
layout: home
title: React & React Native Design System
description: Documentation for Vellira, a production-ready React and React Native design system with accessible UI components, shared design tokens, theming, and TypeScript support.

hero:
  name: Vellira Docs
  text: Documentation for Vellira's cross-platform React and React Native UI system.
  tagline: Accessible components, shared design tokens, and native rendering.
  actions:
    - theme: brand
      text: Get Started
      link: /start/getting-started
    - theme: alt
      text: Components
      link: /react/
    - theme: alt
      text: Vellira Website
      link: https://vellira.dev
---

## Why Vellira

Vellira provides a consistent UI foundation for React and React Native while
keeping each renderer platform-native.

Tokens, interaction logic, and public APIs are shared. Rendering stays
platform-specific.

<div class="docs-card-grid docs-card-grid-three">
  <a class="docs-card" href="/design-system/theme-architecture">
    <strong>Token architecture</strong>
    <span>Primitive colors flow into semantic tokens, component states, and renderer packages.</span>
  </a>
  <a class="docs-card" href="/start/component-overview">
    <strong>Component coverage</strong>
    <span>Button, Input, Checkbox, RadioGroup, Select, FormField, Dropdown, Tabs, Popover, Tooltip, and Modal.</span>
  </a>
  <a class="docs-card" href="/react/">
    <strong>Premium component docs</strong>
    <span>Usage guidance, accessibility contracts, platform notes, and production patterns for every component.</span>
  </a>
  <a class="docs-card" href="/start/getting-started">
    <strong>Fast adoption</strong>
    <span>Install a renderer, import styles where needed, and render your first component.</span>
  </a>
  <a class="docs-card" href="/start/production">
    <strong>Production path</strong>
    <span>Use the install, theming, accessibility, quality, and deploy guidance before shipping.</span>
  </a>
</div>

## Quick Start

Install the React renderer and import styles once in your app entry.

```bash
pnpm add @vellira-ui/react
```

```tsx
import '@vellira-ui/react/styles';

import { Button } from '@vellira-ui/react';

export function Example() {
  return (
    <Button color='primary' appearance='solid'>
      Continue
    </Button>
  );
}
```

For icon-only web actions, use the standard `aria-label` attribute. Native
actions use `accessibilityLabel`.

<p>
  <a class="docs-cta" href="/start/getting-started">Get Started</a>
</p>

## Packages & Libraries

<div class="docs-card-grid docs-card-grid-three">
  <a class="docs-package-card" href="/react/">
    <strong>React</strong>
    <span>Web components</span>
    <code>@vellira-ui/react</code>
  </a>
  <a class="docs-package-card" href="/react-native/">
    <strong>React Native</strong>
    <span>Native components</span>
    <code>@vellira-ui/react-native</code>
  </a>
  <a class="docs-package-card" href="/design-system/tokens">
    <strong>Tokens</strong>
    <span>Design Tokens</span>
    <code>@vellira-ui/tokens</code>
  </a>
  <a class="docs-package-card" href="/icons">
    <strong>Icons</strong>
    <span>Cross-platform Icons</span>
    <code>@vellira-ui/icons</code>
  </a>
<a class="docs-package-card" href="https://vellira.dev">
  <strong>Website</strong>
  <span>Documentation & Showcase</span>
  <code>vellira.dev</code>
</a>
<a class="docs-package-card" href="https://storybook.vellira.dev">
  <strong>Storybook</strong>
  <span>Interactive Component Explorer</span>
<code>storybook.vellira.dev</code>
</a>
</div>

## Features

<div class="docs-feature-list">
  <div>Accessible components</div>
  <div>Shared design tokens</div>
  <div>React & React Native</div>
  <div>TypeScript-first APIs</div>
  <div>Tree-shakeable packages</div>
  <div>Automated CI/CD pipeline</div>
</div>

## Documentation Overview

Use the docs as the main path through the system.

| Goal                           | Page                                                    |
| ------------------------------ | ------------------------------------------------------- |
| Install and render a component | [Quick Start](/start/getting-started)                   |
| Browse component               | [Components](/react/)                                   |
| Compare visual states          | [Component Overview](/start/component-overview)         |
| Understand tokens              | [Theme Architecture](/design-system/theme-architecture) |
| Prepare for production         | [Production](/start/production)                         |
| Use React DOM                  | [React](/react/)                                        |
| Use React Native               | [React Native](/react-native/)                          |

## GitHub

Vellira is developed as a monorepo with package builds, tests, Storybook, smoke
checks, documentation builds, and release automation.

The repository includes Storybook, automated testing, semantic releases, and
fully automated npm publishing.

[Open GitHub Repository](https://github.com/vellira-dev/vellira)
