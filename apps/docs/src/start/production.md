---
title: Production Deployment Guide
description: Prepare Vellira for production with accessibility, testing, CI/CD, bundle optimization, and deployment best practices.
---

# Production

This page covers deploying applications that consume Vellira. For the governed
path Vellira uses to turn approved component intent into validated React and
React Native component candidates, see
[Component Production](/project/component-production).

Install only the renderer and supporting packages your application requires.

## Installation

Vellira is split into focused packages. Install the renderer and supporting
packages your application actually uses.

| Target        | Package                    |
| ------------- | -------------------------- |
| React DOM     | `@vellira-ui/react`        |
| React Native  | `@vellira-ui/react-native` |
| Shared tokens | `@vellira-ui/tokens`       |
| Icons         | `@vellira-ui/icons`        |

## Web Application Checklist

- Import `@vellira-ui/react/styles` once in the app entry.
- Wrap app-level theme switching in `ThemeProvider` when the product exposes
  light, dark, or high-contrast modes.
- Use semantic CSS variables for product surfaces instead of raw palette
  values.
- Verify keyboard interaction for forms, tabs, menus, tooltips, and dialogs.
- Use Storybook during design review to verify visual states and interactions.

## Native Application Checklist

- Install required React Native peer dependencies.
- Test component behavior in Storybook, an Expo playground, or your app shell.
- Verify screen-reader labels, disabled states, and validation text on real
  devices where possible.
- Build layouts with the shared design tokens whenever possible.

## Release Confidence

Before publishing a release or merging significant changes, run the same checks as CI.

```bash
pnpm docs:build
pnpm ci
```

For focused checks:

```bash
pnpm --filter @vellira-ui/react test
pnpm --filter @vellira-ui/react-native test
pnpm --filter @vellira-ui/tokens test
pnpm check:public-api
```

## Deployment

The marketing site is available at `https://vellira.dev`. The documentation
site deploys to `https://docs.vellira.dev` from the `Deploy Docs Worker`
workflow. The workflow builds the VitePress app, verifies the generated
artifact, and deploys it as Cloudflare Worker static assets.

Storybook remains the live component review surface. The target public split is:

| Site                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `vellira.dev`           | Marketing and product positioning              |
| `docs.vellira.dev`      | Documentation, guides, API references, theming |
| `storybook.vellira.dev` | Live component states and visual review        |

Following this checklist helps keep applications consistent with the Vellira
design system while maintaining accessibility, performance, and predictable
releases.
