import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  linkWorkspaceDependencies,
  packPackages,
  run,
  runPnpmInstall,
  shouldBuild,
  writePackageJson,
  writeWorkspaceFile,
} from './utils.mjs';

const root = process.cwd();
const tempDir = path.join(root, '.tmp-package-smoke-web');

const packageNames = [
  '@vellira-ui/react',
  '@vellira-ui/core',
  '@vellira-ui/icons',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
  '@vellira-ui/assets',
];

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

if (shouldBuild()) {
  run('pnpm', ['build']);
}

const dependencies = packPackages(packageNames, tempDir);
const externalDependencies = linkWorkspaceDependencies(
  root,
  tempDir,
  'packages/react',
  ['@floating-ui/react', 'clsx', 'focus-trap-react', 'react', 'react-dom']
);

writePackageJson(tempDir, {
  private: true,
  type: 'module',
  dependencies: {
    ...dependencies,
    ...externalDependencies,
  },
});

writeWorkspaceFile(tempDir, {
  overrides: {
    ...dependencies,
    ...externalDependencies,
  },
});

writeFileSync(
  path.join(tempDir, 'css-loader.mjs'),
  `
export async function load(url, context, defaultLoad) {
  if (url.endsWith('.css') || url.endsWith('.scss')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default undefined;',
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
`
);

writeFileSync(
  path.join(tempDir, 'smoke.mjs'),
  `
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as web from '@vellira-ui/react';
import * as core from '@vellira-ui/core';
import * as icons from '@vellira-ui/icons';
import * as lottieIcons from '@vellira-ui/icons/lottie';
import * as tokens from '@vellira-ui/tokens';
import '@vellira-ui/assets/styles';

const componentTypes = new Set([
  Symbol.for('react.forward_ref'),
  Symbol.for('react.memo'),
]);

function isComponentExport(value) {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && componentTypes.has(value.$$typeof))
  );
}

const expectedWebApi = [
  'Accordion',
  'Button',
  'Checkbox',
  'Dropdown',
  'FormField',
  'Input',
  'Modal',
  'Popover',
  'Portal',
  'PortalProvider',
  'Radio',
  'RadioGroup',
  'Select',
  'Switch',
  'Tabs',
  'Textarea',
  'ThemeProvider',
  'Tooltip',
  'useTheme',
];

const actualWebApi = Object.keys(web).sort();

if (JSON.stringify(actualWebApi) !== JSON.stringify(expectedWebApi)) {
  throw new Error(
    \`react public API mismatch. Expected \${expectedWebApi.join(', ')}, got \${actualWebApi.join(', ')}\`
  );
}

if (!isComponentExport(web.Button)) {
  throw new Error('react Button export invalid');
}

if (!isComponentExport(web.Input)) {
  throw new Error('react Input export invalid');
}

if (!isComponentExport(web.Tabs)) {
  throw new Error('react Tabs export invalid');
}

if (!isComponentExport(web.ThemeProvider)) {
  throw new Error('react ThemeProvider export invalid');
}

if (!isComponentExport(web.Portal)) {
  throw new Error('react Portal export invalid');
}

if (!isComponentExport(web.PortalProvider)) {
  throw new Error('react PortalProvider export invalid');
}

if (typeof web.useTheme !== 'function') {
  throw new Error('react useTheme export invalid');
}

if (typeof core.createAutoFocusEvent !== 'function') {
  throw new Error('core createAutoFocusEvent export invalid');
}

if (typeof core.getFocusableElements !== 'function') {
  throw new Error('core getFocusableElements export invalid');
}

if (typeof icons.Check !== 'function') {
  throw new Error('icons Check export invalid');
}

if (typeof icons.Search !== 'function') {
  throw new Error('icons Search export invalid');
}

if (
  !lottieIcons.animatedIcons.Search ||
  !lottieIcons.animatedIconManifest.icons?.length
) {
  throw new Error('icons lottie export invalid');
}

const { colors } = tokens.theme;

if (typeof tokens.darkTheme !== 'object' || tokens.darkTheme === null) {
  throw new Error('tokens darkTheme export invalid');
}

if (typeof tokens.lightTheme !== 'object' || tokens.lightTheme === null) {
  throw new Error('tokens lightTheme export invalid');
}

if (
  typeof tokens.highContrastTheme !== 'object' ||
  tokens.highContrastTheme === null
) {
  throw new Error('tokens highContrastTheme export invalid');
}

const theme = tokens.darkTheme;

if (!theme.colors) {
  throw new Error('primitive color tokens missing');
}

if (!theme.semantic) {
  throw new Error('semantic tokens missing');
}

if (!theme.components) {
  throw new Error('component tokens missing');
}

if (!theme.tokens) {
  throw new Error('shared base tokens missing');
}

if (!theme.semantic.surface) {
  throw new Error('surface semantic tokens missing');
}

if (!theme.semantic.text) {
  throw new Error('text semantic tokens missing');
}

if (!theme.semantic.border) {
  throw new Error('border semantic tokens missing');
}

if (!theme.semantic.status) {
  throw new Error('status semantic tokens missing');
}

if (!theme.semantic.focus) {
  throw new Error('focus semantic tokens missing');
}

if (!theme.semantic.divider) {
  throw new Error('divider semantic tokens missing');
}

if (!theme.semantic.skeleton) {
  throw new Error('skeleton semantic tokens missing');
}

if (!theme.components.button) {
  throw new Error('button component tokens missing');
}

if (!theme.components.input) {
  throw new Error('input component tokens missing');
}

if (!theme.components.checkbox) {
  throw new Error('checkbox component tokens missing');
}

if (!theme.components.select) {
  throw new Error('select component tokens missing');
}

const isColorToken = (value) =>
  typeof value === 'string' &&
  (value === 'transparent' || /^#[0-9a-f]{6}$/i.test(value));

const assertColor = (value, name) => {
  if (!isColorToken(value)) {
    throw new Error(name + ' token invalid');
  }
};

assertColor(theme.semantic.surface.default, 'semantic.surface.default');
assertColor(theme.semantic.text.primary, 'semantic.text.primary');
assertColor(theme.semantic.status.success.fg, 'semantic.status.success.fg');
assertColor(
  theme.components.button.primary.solid.default.bg,
  'components.button.primary.solid.default.bg'
);
assertColor(theme.components.input.default.bg, 'components.input.default.bg');

await import('@vellira-ui/react/styles');

const assetFiles = [
  '@vellira-ui/assets/styles/fonts.css',
  '@vellira-ui/assets/fonts/VelliraSans-Regular.woff2',
];

for (const assetFile of assetFiles) {
  const assetPath = fileURLToPath(import.meta.resolve(assetFile));

  if (!assetPath.includes('node_modules/@vellira-ui/assets/')) {
    throw new Error(assetFile + ' did not resolve from the installed assets package');
  }

  if (!existsSync(assetPath)) {
    throw new Error(assetFile + ' is missing from the installed assets package');
  }
}

console.log('Web package smoke test passed');
`
);

runPnpmInstall(tempDir);
run('node', ['--loader', './css-loader.mjs', 'smoke.mjs'], { cwd: tempDir });

if (!existsSync(path.join(tempDir, 'node_modules'))) {
  throw new Error('Smoke install failed');
}
