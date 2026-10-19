# Try Vellira: the same form state on React and React Native

A small, **local-only** email/preferences form for developers evaluating
Vellira.
It uses public components in both renderers: `Input`, `Checkbox`, and `Button`.

The two examples intentionally share the *product state shape* and controlled
value callbacks, not the rendering implementation:

| Concern          | Web                                   | React Native                    |
| ---------------- | ------------------------------------- | ------------------------------- |
| Email value      | `onValueChange(email)`                | `onValueChange(email)`          |
| Preference       | `onCheckedChange(checked)`            | `onCheckedChange(checked)`      |
| Submission       | `<form onSubmit>` and `type='submit'` | `Button onPress`                |
| Labels, feedback | Browser semantics                     | Native accessibility primitives |

The examples **do not send data**, call a backend, or subscribe anyone to a
mailing list.
A valid submission displays a preview of the form data on screen.

## Run the React example

Use Node.js 22+ and a recent npm version. From the **Vellira repository root**:

```sh
REPO_ROOT="$PWD"
mkdir -p "$HOME/vellira-evaluation"
cd "$HOME/vellira-evaluation"
npm create vite@latest web -- --template react-ts
cp "$REPO_ROOT/examples/cross-platform-form/web/App.tsx" web/src/App.tsx
cp "$REPO_ROOT/examples/cross-platform-form/web/index.css" web/src/index.css
cd web
npm install
npm install @vellira-ui/react
npm run dev
```

The demo replaces the starter `src/index.css` to avoid create-vite's centered
page layout and large generic h1 styles. Vellira's web example imports
`@vellira-ui/react/styles` itself. Open the local URL printed by Vite.
To check a production compile: `npm run build`.

## Run the React Native example

In a new terminal, from the **Vellira repository root**:

```sh
REPO_ROOT="$PWD"
mkdir -p "$HOME/vellira-evaluation"
cd "$HOME/vellira-evaluation"
npx create-expo-app@latest native --template blank-typescript
cp "$REPO_ROOT/examples/cross-platform-form/native/App.tsx" native/App.tsx
cd native
npx expo install @react-native-picker/picker react-native-svg
npm install @vellira-ui/react-native
npx expo start
```

Use an Expo SDK **57 / React Native 0.86+** app for current Vellira Native
renderer compatibility. Follow Expo's on-screen instructions to open an
emulator or device.
The first native launch may require platform setup.

## What to evaluate

1. Type an invalid email and submit. Does each runtime surface a useful error?
2. Type a valid email, toggle the checkbox, and preview the same state shape.
3. Try keyboard interaction on Web and touch/assistive tech on Native.
4. Tell us which step was unclear, broken, or unnecessarily different.

We want candid technical feedback, not stars or mailing-list signups.
Open a [GitHub issue](https://github.com/vellira-dev/vellira/issues)
with the environment and exact reproduction steps.

For a more advanced form (FormField and Select), see the
[React + React Native form walkthrough](https://vellira.dev/blog/cross-platform-form-vellira).

> This is an evaluation recipe, **not** a tested standalone template or a
> native-device compatibility claim. Verify both routes before promoting the
> demo to a public launch artifact.
