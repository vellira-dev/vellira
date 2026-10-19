# Vellira Workspace Starter

A **working mini-application**, not a static screenshot or an isolated Button
demo. This sample lets independent developers explore Vellira's public UI
components in a realistic project.

The two apps use **published Vellira 2.173.0 packages**, not local workspace
source imports. They are independently installable and work without a Vellira
account or backend.

## What you can do

| Interaction | React Web | React Native |
| --- | --- | --- |
| Overview with live project counts | Yes | Yes |
| Project search and status filtering | Yes | Yes |
| Create projects using Vellira Modal | Yes | Yes |
| Complete, duplicate, or remove projects | Yes | Yes |
| Navigate with Vellira Tabs | Yes | Yes |
| Edit workspace via Input and Checkbox | Yes | Yes |
| Switch light/dark/high-contrast themes | Yes | Yes |
| Keep edits after restarting | Browser localStorage | Device AsyncStorage |
| Remote server/account/payment required | No | No |

Web demonstrates Dropdown action menus; native uses touch-oriented Button
actions. The shared product intention is stable, but rendering, event semantics,
focus and overlay behavior remain native to each platform.

## Run React Web

Node.js 22+ is recommended.

```sh
git clone https://github.com/vellira-dev/vellira.git
cd vellira/examples/workspace-starter/web
npm install
npm run dev
```

Open the URL shown by Vite, usually http://localhost:5173.

Verify the distributable app and TypeScript:

```sh
npm run build
```

Main files: `web/src/App.tsx`, `web/src/model.ts`,
`web/src/styles.css`.

## Run React Native

Requires Expo SDK 57 / React Native 0.86 and an iOS or Android emulator, or a
compatible development device. From the repository:

```sh
cd examples/workspace-starter/native
npm install
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
2. Create a new project using the modal, then duplicate or remove it.
3. Mark a project complete and watch the Overview counters change.
4. Edit the workspace name and notification preference.
5. Switch themes, reload or restart the app, and check locally saved changes.
6. Read the source and adapt the UI to your own product.

The Web starter uses a Vellira Modal, Dropdown, Tabs, Select, Input, Checkbox,
Button and ThemeProvider. The Native starter uses platform-appropriate Vellira
implementations of the same fundamental building blocks.

## What this starter does not implement

No authentication, persistence API, server, payments, multiuser collaboration,
network requests, or real customer data. The sample projects are fictional.
Changes are stored locally when device/browser storage is available.

This is a **starting point**, not an audited production application. Before
shipping an adapted version, integrate your own backend and validate
accessibility, security and device/browser support.

Both apps intentionally live outside the root pnpm workspace. Running
`npm install` in the individual app directory uses the public npm packages,
not `workspace:*` references.

## Feedback

Please report the runtime, package versions, exact reproduction steps, and
expected behavior in [GitHub Issues](https://github.com/vellira-dev/vellira/issues).

See the [React docs](https://docs.vellira.dev/react/), the
[React Native docs](https://docs.vellira.dev/react-native/), and the
[cross-platform form article](https://vellira.dev/blog/cross-platform-form-vellira).
