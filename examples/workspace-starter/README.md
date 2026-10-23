# Vellira Dashboard Starter — Free Core Demo

A **working, MIT-licensed Core demonstration** with one shared React Dashboard
component used both by Vellira's homepage and the standalone Vite starter.
Not a screenshot, paywall or commercial production template. React and React Native developers can run it,
inspect the Vellira APIs, and adapt the project to their own work.

Both apps pin **Vellira 2.186.4 packages**. They are independently installable
and work without a Vellira account, backend or Pro subscription. The public
source remains available under the repository's MIT license.

Both examples check in npm integrity-locked dependency trees. Use `npm ci` to
install the reviewed, reproducible published npm dependency graph.

After a complete published Vellira release, the Workspace Starter Release Sync
workflow opens a reviewable PR to update these exact pins and npm lockfiles. The PR must pass
fresh npm Web/Expo consumer checks before it is merged; no versions are pushed
directly to `main` or changed for existing users without review.

## What you can do

| Interaction                                        | React Web            | React Native        |
| -------------------------------------------------- | -------------------- | ------------------- |
| Overview with live project counts                  | Yes                  | Yes                 |
| Project search and status filtering                | Yes                  | Yes                 |
| Create projects using Vellira Modal                | Yes                  | Yes                 |
| Complete, edit, duplicate, remove or undo projects | Yes                  | Yes                 |
| Navigate with Vellira components                   | Buttons              | Tabs                |
| Edit workspace via Input and Checkbox              | Yes                  | Yes                 |
| Switch light/dark/high-contrast themes             | Yes                  | Yes                 |
| Keep edits after restarting                        | Browser localStorage | Device AsyncStorage |
| Remote server/account/payment required             | No                   | No                  |

Web demonstrates Dropdown action menus; native uses touch-oriented Button
actions. The shared product intention is stable, but rendering, event semantics,
focus and overlay behavior remain native to each platform.

## Run React Web

Node.js 22+ is recommended.

```sh
git clone https://github.com/vellira-dev/vellira.git
cd vellira/examples/workspace-starter/web
npm ci
npm run dev
```

Open the URL shown by Vite, usually http://localhost:5173.

Verify the distributable app and TypeScript:

```sh
npm run build
```

Main files: `web/src/Dashboard.tsx`, `web/src/Dashboard.module.css`,
`web/src/App.tsx`, `web/src/model.ts`, and `web/src/styles.css`.

To update the website showcase after editing the Web source, run from the
repository root:

```sh
node scripts/website/sync-dashboard-starter.mjs
node scripts/website/sync-dashboard-starter.mjs --check
```

The website keeps generated JSX/CSS copies for independent deployments; only
the relative model import changes. The checked-in parity test catches drift.

## Run React Native

Requires Expo SDK 57 / React Native 0.86 and an iOS or Android emulator, or a
compatible development device. From the repository:

```sh
cd examples/workspace-starter/native
npm ci
npm run start
```

Follow Expo's device/emulator instructions. To typecheck:

```sh
npm run typecheck
```

Main file: `native/App.tsx`.

The Native package versions match Vellira's current development baseline.
Use real devices to verify focus, accessibility announcements, touch targets,
and native overlays before relying on those behaviors in production.

## Try the actual interactions

1. Visit Projects, search and filter by status.
2. Create or edit projects with descriptions, teams and statuses; try Remove and Undo.
3. Mark a project complete, then uncheck Done to restore its earlier status.
4. Edit the workspace name and notification preference.
5. Switch themes, reload or restart the app, and check locally saved changes.
6. Read the source and adapt the UI to your own product.

The Web starter uses Vellira Modal, Dropdown, Button, Select, Input,
Checkbox and ThemeProvider. The Native starter uses platform-appropriate Vellira
implementations of the same fundamental building blocks.

## What this starter does not implement

No authentication, persistence API, server, payments, multiuser collaboration,
network requests, or real customer data. The sample projects are fictional.
Changes are stored locally when device/browser storage is available.

This is a **starting point**, not an audited production application. Before
shipping an adapted version, integrate your own backend and validate
accessibility, security and device/browser support.

The Web demo deliberately uses **40px compact controls**. Published Core
size tokens remain unchanged: `sm=38px`, `md=46px`, and `lg=52px`.
This scoped density is not a new public component size. Native controls
retain platform-specific sizes.

The website's embedded Desktop, Mobile Web iframe and Full Demo share data
when served from the same origin. The standalone Vite starter runs on its
own browser origin and intentionally has separate local storage.

Native release validation needs a real iOS and Android device: test nested
Select in Modal, create/edit/Undo, reset confirmation, theme persistence,
high-contrast, touch targets and screen-reader announcements. Expo CI
currently checks TypeScript and configuration, not device interaction.

Both apps intentionally live outside the root pnpm workspace. Running
`npm install` in the individual app directory uses the public npm packages,
not `workspace:*` references.

## Feedback

Please report the runtime, package versions, exact reproduction steps, and
expected behavior in [GitHub Issues](https://github.com/vellira-dev/vellira/issues).

See the [React docs](https://docs.vellira.dev/react/), the
[React Native docs](https://docs.vellira.dev/react-native/), and the
[cross-platform form article](https://vellira.dev/blog/cross-platform-form-vellira).

## Free Core versus future paid products

This starter is **Core**: Vellira React/React Native controls, accessible
interactions, semantic tokens/themes, documentation, examples, known correctness
checks, local demonstration state, and source code remain freely usable.

Future **Vellira Pro** may offer managed multi-project workflows, richer
analysis/automation and team governance. Advanced **application kits** (such as
production-oriented SaaS dashboards with real auth, role management, billing,
server persistence and integrations) may be separately licensed premium
products. None of those are included or claimed to work in this free demo.
Commercial packaging and pricing have not been finalized.

The public demo must remain useful without Pro. No paid implementation, secret,
production customer data, proprietary template, paid-license mechanism or
artificially disabled Core correctness checks belong in this directory.

### Published source links

The homepage's View Source and Use This Starter links point to the canonical
`main` branch and become available once the release PR is merged.
Website and Vite Starter keep synchronized `Dashboard` implementations;
browser storage stays scoped to each website origin.
Previously stored Northstar seed names are migrated to Demo Workspace.
