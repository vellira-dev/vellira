import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import {
  componentTokenPaths,
  semanticTokenPaths,
  themeCssVariableNames,
} from './generated/token-types.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';
import {
  adaptComponentTokensForWeb,
  createComponentPlatformOutputSources,
  isComponentPlatformIntent,
} from './platform-output/component-token-intents.js';
import { componentTokenWebCompatibilityAliases } from './platform-output/component-token-web-compatibility.js';
import {
  canonicalSemanticRolePaths,
  canonicalTokenVocabulary,
  maintainedComponentFactories,
  tokenArchitectureAuditFindings,
  tokenArchitectureFlow,
  tokenArchitectureLayers,
} from './token-architecture.js';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const factoriesDirectory = path.join(
  packageRoot,
  'src',
  'factories',
  'components'
);

const themes = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
] as const;

type TokenObject = Record<string, unknown>;

const toKebabCase = (str: string) =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase();

const isPlainObject = (value: unknown): value is TokenObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const collectLeafPaths = (obj: TokenObject, prefix = ''): string[] => {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}.${key}` : key;

    if (isComponentPlatformIntent(value)) {
      paths.push(name);
      continue;
    }

    if (isPlainObject(value)) {
      paths.push(...collectLeafPaths(value, name));
      continue;
    }

    paths.push(name);
  }

  return paths.sort();
};

const collectCssVariables = (obj: TokenObject, prefix = ''): string[] => {
  const variables: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${toKebabCase(key)}` : toKebabCase(key);

    if (isComponentPlatformIntent(value)) {
      throw new Error(
        `collectCssVariables received canonical platform intent at ${name}; adapt components for Web first.`
      );
    }

    if (isPlainObject(value)) {
      variables.push(...collectCssVariables(value, name));
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      variables.push(`--${name}`);
    }
  }

  return variables.sort();
};

const readThemeBlock = (css: string, selector: string) => {
  const marker = `${selector} {\n`;
  const start = css.indexOf(marker);

  if (start === -1) {
    throw new Error(`Missing generated theme block: ${selector}`);
  }

  const bodyStart = start + marker.length;
  const end = css.indexOf('\n}\n', bodyStart);

  if (end === -1) {
    throw new Error(`Unterminated generated theme block: ${selector}`);
  }

  return css.slice(bodyStart, end);
};

type Rgb = {
  red: number;
  green: number;
  blue: number;
};

const parseHexColor = (value: string): Rgb | null => {
  const match = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);

  if (!match) return null;

  const [red, green, blue] = match[1]!
    .match(/../g)!
    .map((channel) => parseInt(channel, 16));

  return { red: red!, green: green!, blue: blue! };
};

const parseRgbColor = (value: string): (Rgb & { alpha: number }) | null => {
  const hex = parseHexColor(value);

  if (hex) return { ...hex, alpha: 1 };

  const match = value.match(
    /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(0|1|0?\.\d+)\)$/i
  );

  if (!match) return null;

  return {
    red: Number(match[1]),
    green: Number(match[2]),
    blue: Number(match[3]),
    alpha: Number(match[4]),
  };
};

const blendColor = (
  foreground: Rgb & { alpha: number },
  background: Rgb
): Rgb => ({
  red: Math.round(
    foreground.red * foreground.alpha + background.red * (1 - foreground.alpha)
  ),
  green: Math.round(
    foreground.green * foreground.alpha +
      background.green * (1 - foreground.alpha)
  ),
  blue: Math.round(
    foreground.blue * foreground.alpha +
      background.blue * (1 - foreground.alpha)
  ),
});

const relativeLuminance = ({ red, green, blue }: Rgb) => {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrastRatio = (
  foreground: string,
  background: string,
  canvas = background
) => {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseRgbColor(background);
  const canvasRgb = parseHexColor(canvas);

  if (!foregroundRgb || !backgroundRgb || !canvasRgb) {
    throw new Error(
      `Contrast contracts require opaque hex colors. Received ${foreground} on ${background}.`
    );
  }

  const resolvedBackground =
    backgroundRgb.alpha === 1
      ? backgroundRgb
      : blendColor(backgroundRgb, canvasRgb);

  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(resolvedBackground);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

describe('canonical token architecture contract', () => {
  it('documents the canonical ownership flow for agents and generators', () => {
    expect(tokenArchitectureLayers).toEqual([
      'primitive',
      'semantic',
      'component-factory',
      'component',
      'platform-output',
      'consumer',
    ]);
    expect(tokenArchitectureFlow).toBe(
      'primitive -> semantic -> component-factory -> component -> platform-output -> consumer'
    );
  });

  it('keeps canonical semantic roles present in every theme', () => {
    for (const [themeName, theme] of themes) {
      const paths = collectLeafPaths(theme.semantic).sort();

      expect(collectLeafPaths(theme.semantic, 'semantic').sort()).toEqual(
        [...semanticTokenPaths].sort()
      );

      for (const rolePath of canonicalSemanticRolePaths) {
        expect(paths, `${themeName} is missing ${rolePath}`).toContain(
          rolePath
        );
      }
    }
  });

  it('keeps semantic and component token shapes identical across themes', () => {
    const [lightSemanticPaths, lightComponentPaths] = [
      collectLeafPaths(lightTheme.semantic),
      collectLeafPaths(lightTheme.components),
    ];

    for (const [themeName, theme] of themes.slice(1)) {
      expect(collectLeafPaths(theme.semantic), `${themeName} semantic`).toEqual(
        lightSemanticPaths
      );
      expect(
        collectLeafPaths(theme.components),
        `${themeName} components`
      ).toEqual(lightComponentPaths);
    }

    expect(collectLeafPaths(lightTheme.semantic, 'semantic')).toEqual(
      [...semanticTokenPaths].sort()
    );
    expect(collectLeafPaths(lightTheme.components, 'components')).toEqual(
      [...componentTokenPaths].sort()
    );
  });

  it('keeps generated CSS variables aligned with JS token paths', () => {
    const css = fs.readFileSync(
      path.join(packageRoot, 'src/generated/tokens.css'),
      'utf8'
    );

    const cases = [
      {
        selector: ":root,\n[data-theme='light'],\n[data-vellira-theme='light']",
        theme: lightTheme,
      },
      {
        selector: "[data-theme='dark'],\n[data-vellira-theme='dark']",
        theme: darkTheme,
      },
      {
        selector:
          "[data-theme='high-contrast'],\n[data-vellira-theme='high-contrast']",
        theme: highContrastTheme,
      },
    ] as const;

    const expectedVariables = [...themeCssVariableNames].sort();

    for (const { selector, theme } of cases) {
      const block = readThemeBlock(css, selector);
      const serializedVariables = Array.from(
        block.matchAll(/^\s+(--[a-z0-9-]+):/gm),
        ([, variable]) => variable!
      ).sort();
      const webComponents = adaptComponentTokensForWeb(
        theme.components,
        createComponentPlatformOutputSources(theme)
      );
      const objectVariables = [
        ...collectCssVariables(theme.colors, 'color'),
        ...collectCssVariables(theme.semantic),
        ...collectCssVariables(webComponents),
        ...componentTokenWebCompatibilityAliases.map(
          ({ variable }) => variable
        ),
      ].sort();

      expect(objectVariables).toEqual(expectedVariables);
      expect(serializedVariables).toEqual(expectedVariables);
    }
  });

  it('keeps maintained factory state keys within the canonical vocabulary', () => {
    const allowedStates = new Set(canonicalTokenVocabulary.state);

    for (const factory of maintainedComponentFactories) {
      for (const stateKey of factory.stateKeys) {
        const normalized = stateKey
          .replace(/^selected/, '')
          .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
        const canonicalState =
          stateKey === 'expanded'
            ? 'selected'
            : canonicalTokenVocabulary.intent.includes(
                  stateKey as (typeof canonicalTokenVocabulary.intent)[number]
                )
              ? 'default'
              : canonicalTokenVocabulary.status.includes(
                    stateKey as (typeof canonicalTokenVocabulary.status)[number]
                  )
                ? 'default'
                : normalized === ''
                  ? 'selected'
                  : normalized;

        expect(
          allowedStates.has(
            canonicalState as (typeof canonicalTokenVocabulary.state)[number]
          ),
          `${factory.name} uses noncanonical state key ${stateKey}`
        ).toBe(true);
      }
    }
  });

  it('keeps the maintained factory registry aligned with factory source files', async () => {
    const registrySources = maintainedComponentFactories
      .map((factory) => factory.source)
      .sort();
    const sourceFiles = fs
      .readdirSync(factoriesDirectory)
      .filter((file) => /^create.*\.ts$/.test(file))
      .map((file) =>
        path
          .relative(repositoryRoot, path.join(factoriesDirectory, file))
          .split(path.sep)
          .join('/')
      )
      .sort();

    expect(registrySources).toEqual(sourceFiles);

    for (const factory of maintainedComponentFactories) {
      const sourcePath = path.join(repositoryRoot, factory.source);

      expect(
        fs.existsSync(sourcePath),
        `${factory.name} source path is stale: ${factory.source}`
      ).toBe(true);

      const module = await import(pathToFileURL(sourcePath).href);

      expect(
        module,
        `${factory.name} is not exported by ${factory.source}`
      ).toHaveProperty(factory.name);

      if (factory.semanticAdapter !== null) {
        expect(
          module,
          `${factory.semanticAdapter} is not exported by ${factory.source}`
        ).toHaveProperty(factory.semanticAdapter);
      }
    }
  });

  it('records non-architectural visual findings outside token normalization', () => {
    expect(tokenArchitectureAuditFindings).toContainEqual(
      expect.objectContaining({
        id: 'website-text-tertiary',
        classification: 'H',
      })
    );
  });
});

describe.each(themes)('%s contrast contracts', (_themeName, theme) => {
  const contracts = [
    [
      'text.primary on surface.default',
      theme.semantic.text.primary,
      theme.semantic.surface.default,
      4.5,
    ],
    [
      'text.secondary on surface.default',
      theme.semantic.text.secondary,
      theme.semantic.surface.default,
      3,
    ],
    [
      'text.muted on surface.default',
      theme.semantic.text.muted,
      theme.semantic.surface.default,
      2.9,
    ],
    [
      'text.disabled on surface.default',
      theme.semantic.text.disabled,
      theme.semantic.surface.default,
      2.9,
    ],
    [
      'text.inverse on surface.inverse',
      theme.semantic.text.inverse,
      theme.semantic.surface.inverse,
      4.5,
    ],
    [
      'interactive text on surface.default',
      theme.semantic.text.interactive,
      theme.semantic.surface.default,
      4.5,
    ],
    [
      'focus ring on surface.default',
      theme.semantic.focus.ring.color,
      theme.semantic.surface.default,
      3,
    ],
    [
      'status.success content',
      theme.semantic.status.success.fg,
      theme.semantic.status.success.bg,
      3,
    ],
    [
      'status.error content',
      theme.semantic.status.error.fg,
      theme.semantic.status.error.bg,
      3,
    ],
    [
      'status.warning content',
      theme.semantic.status.warning.fg,
      theme.semantic.status.warning.bg,
      3,
    ],
    [
      'status.info content',
      theme.semantic.status.info.fg,
      theme.semantic.status.info.bg,
      3,
    ],
  ] as const;

  for (const [name, foreground, background, minimum] of contracts) {
    it(`keeps ${name} above ${minimum}:1`, () => {
      expect(
        contrastRatio(foreground, background, theme.semantic.surface.default)
      ).toBeGreaterThanOrEqual(minimum);
    });
  }
});
