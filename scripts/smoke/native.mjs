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
const tempDir = path.join(root, '.tmp-package-smoke-native');

const packageNames = [
  '@vellira-ui/react-native',
  '@vellira-ui/core',
  '@vellira-ui/icons',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
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
  'packages/react-native',
  ['@react-native-picker/picker', 'react', 'react-native']
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

const mocksDir = path.join(tempDir, 'mocks');
mkdirSync(mocksDir, { recursive: true });

writeFileSync(
  path.join(mocksDir, 'react-native.mjs'),
  `
const Component = () => null;

export const Animated = {
  View: Component,

  Value: class {
    setValue() {}

    interpolate() {
      return '';
    }
  },

  timing() {
    return {
      start(callback) {
        callback?.();
      },

      stop() {},
    };
  },

  parallel() {
    return {
      start(callback) {
        callback?.();
      },

      stop() {},
    };
  },

  sequence() {
    return {
      start(callback) {
        callback?.();
      },

      stop() {},
    };
  },
};

export const Easing = {
  linear(value) {
    return value;
  },

  ease(value) {
    return value;
  },

  bezier() {
    return (value) => value;
  },

  in(easing) {
    return easing;
  },

  out(easing) {
    return easing;
  },

  inOut(easing) {
    return easing;
  },
};

export const Dimensions = {
  get() {
    return { width: 1024, height: 768 };
  },
};

export const Platform = {
  OS: 'ios',

  select(specifics) {
    return specifics.ios ?? specifics.native ?? specifics.default;
  },
};

export const BackHandler = {
  addEventListener() {
    return {
      remove() {},
    };
  },
};

export const AccessibilityInfo = {
  announceForAccessibility() {},
  setAccessibilityFocus() {},

  isReduceMotionEnabled() {
    return Promise.resolve(false);
  },

  addEventListener() {
    return {
      remove() {},
    };
  },
};

export function findNodeHandle() {
  return 1;
}

export function useWindowDimensions() {
  return { width: 1024, height: 768, scale: 1, fontScale: 1 };
}

export const View = Component;
export const Text = Component;
export const TextInput = Component;
export const Pressable = Component;
export const Modal = Component;
export const ActivityIndicator = Component;
export const ScrollView = Component;
export const FlatList = Component;
export const SectionList = Component;
export const Image = Component;
export const Switch = Component;
export const SafeAreaView = Component;

export const StyleSheet = {
  absoluteFill: {},
  create(styles) {
    return styles;
  },
};
`
);

writeFileSync(
  path.join(mocksDir, 'react-native-svg.mjs'),
  `
const Component = () => null;

export const ClipPath = Component;
export const Defs = Component;
export const G = Component;
export const Path = Component;
export const Rect = Component;
export default Component;
`
);

writeFileSync(
  path.join(mocksDir, 'react-native-picker.mjs'),
  `
export const Picker = () => null;
`
);

writeFileSync(
  path.join(tempDir, 'native-loader.mjs'),
  `
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mocks = {
  'react-native': new URL('./mocks/react-native.mjs', import.meta.url).href,
  'react-native-svg': new URL('./mocks/react-native-svg.mjs', import.meta.url).href,
  '@react-native-picker/picker': new URL('./mocks/react-native-picker.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, defaultResolve) {
  if (specifier in mocks) {
    return {
      shortCircuit: true,
      url: mocks[specifier],
    };
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      throw error;
    }

    const url = new URL(specifier, context.parentURL);
    const filePath = fileURLToPath(url);
    const candidates = [
      \`\${filePath}.js\`,
      \`\${filePath}/index.js\`,
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        };
      }
    }

    throw error;
  }
}
`
);

writeFileSync(
  path.join(tempDir, 'smoke.mjs'),
  `
import * as native from '@vellira-ui/react-native';
import * as core from '@vellira-ui/core';
import * as icons from '@vellira-ui/icons';
import * as lottieIcons from '@vellira-ui/icons/lottie';
import * as tokens from '@vellira-ui/tokens';

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

const expectedNativeApi = [
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
  'nativeThemes',
  'useTheme',
];

const actualNativeApi = Object.keys(native).sort();

if (JSON.stringify(actualNativeApi) !== JSON.stringify(expectedNativeApi)) {
  throw new Error(
    \`react-native public API mismatch. Expected \${expectedNativeApi.join(', ')}, got \${actualNativeApi.join(', ')}\`
  );
}

if (!isComponentExport(native.Button)) {
  throw new Error('react-native Button export invalid');
}

if (!isComponentExport(native.Input)) {
  throw new Error('react-native Input export invalid');
}

if (!isComponentExport(native.Tabs)) {
  throw new Error('react-native Tabs export invalid');
}

if (!isComponentExport(native.ThemeProvider)) {
  throw new Error('react-native ThemeProvider export invalid');
}

if (!isComponentExport(native.Portal)) {
  throw new Error('react-native Portal export invalid');
}

if (!isComponentExport(native.PortalProvider)) {
  throw new Error('react-native PortalProvider export invalid');
}

if (typeof native.useTheme !== 'function') {
  throw new Error('react-native useTheme export invalid');
}

const expectedThemeNames = ['dark', 'highContrast', 'light'];
const actualThemeNames = Object.keys(native.nativeThemes ?? {}).sort();

if (JSON.stringify(actualThemeNames) !== JSON.stringify(expectedThemeNames)) {
  throw new Error(
    \`react-native nativeThemes export invalid. Expected \${expectedThemeNames.join(', ')}, got \${actualThemeNames.join(', ')}\`
  );
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

function isColorToken(value) {
  return (
    typeof value === 'string' &&
    (value === 'transparent' || /^#[0-9a-f]{6}$/i.test(value))
  );
}

function assertColorToken(value, name) {
  if (!isColorToken(value)) {
    throw new Error(name + ' token invalid');
  }
}

assertColorToken(theme.semantic.surface.default, 'semantic.surface.default');
assertColorToken(theme.semantic.text.primary, 'semantic.text.primary');
assertColorToken(theme.semantic.status.success.fg, 'semantic.status.success.fg');
assertColorToken(
  theme.components.button.primary.solid.default.bg,
  'components.button.primary.solid.default.bg'
);
assertColorToken(theme.components.input.default.bg, 'components.input.default.bg');

console.log('Native package smoke test passed');
`
);

runPnpmInstall(tempDir);
run(
  'node',
  ['--conditions=react-native', '--loader', './native-loader.mjs', 'smoke.mjs'],
  {
    cwd: tempDir,
  }
);

if (!existsSync(path.join(tempDir, 'node_modules'))) {
  throw new Error('Smoke install failed');
}
