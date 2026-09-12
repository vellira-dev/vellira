import fs from 'node:fs';
import path from 'node:path';

import { maintainedComponentFactories } from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

const themes = ['light', 'dark', 'highContrast'] as const;
const factoryNamePattern = /^create[A-Z][A-Za-z0-9]*Tokens$/;
const paletteHelperPattern = /^create([A-Z][A-Za-z0-9]*)IntentPalette\.ts$/;
const expectedFactoryRootEntries = new Map([
  ['components', 'directory'],
  ['index.ts', 'file'],
  ['palettes', 'directory'],
  ['shared', 'directory'],
] as const);
const expectedSharedHelpers = new Set(['componentFocusRing.ts']);

function finding(
  code: string,
  sourcePath: string,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.factory-convention',
    code,
    severity: 'error',
    sourcePath,
    tokenPath: null,
    line: null,
    column: null,
    layer: 'component-factory',
    theme: null,
    platform: null,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Restore the canonical component, palette, or shared factory responsibility and route theme construction through the canonical full-component factory.',
  };
}

function typescriptFiles(directory: string) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function lowerFirst(value: string) {
  return `${value[0]!.toLowerCase()}${value.slice(1)}`;
}

export function checkTokenFactoryConventions(root: string): RuleResult {
  const findings: FindingInput[] = [];
  const factoriesRoot = path.join(root, 'packages/tokens/src/factories');
  const componentsRoot = path.join(factoriesRoot, 'components');
  const palettesRoot = path.join(factoriesRoot, 'palettes');
  const sharedRoot = path.join(factoriesRoot, 'shared');
  const expectedSources = new Set<string>();
  let checked = 0;

  for (const factory of maintainedComponentFactories) {
    checked += 1;
    const expectedSource = `packages/tokens/src/factories/components/${factory.name}.ts`;
    expectedSources.add(expectedSource);

    if (!factoryNamePattern.test(factory.name) || factory.name.includes('Palette')) {
      findings.push(
        finding(
          'invalid-canonical-factory-name',
          factory.source,
          `Maintained factory is named ${factory.name}.`,
          'Canonical full-component factories must use create<Component>Tokens.'
        )
      );
    }

    if (factory.source !== expectedSource) {
      findings.push(
        finding(
          'invalid-canonical-factory-path',
          factory.source,
          `${factory.name} is registered at ${factory.source}.`,
          expectedSource
        )
      );
    }

    if (!fs.existsSync(path.join(root, expectedSource))) {
      findings.push(
        finding(
          'missing-canonical-factory-source',
          expectedSource,
          `${factory.name} is registered but its canonical source is missing.`,
          expectedSource
        )
      );
    }
  }

  const componentFiles = typescriptFiles(componentsRoot).map((name) =>
    path.posix.join('packages/tokens/src/factories/components', name)
  );
  checked += componentFiles.length;
  for (const source of componentFiles) {
    if (!expectedSources.has(source)) {
      findings.push(
        finding(
          'unregistered-component-factory',
          source,
          'A full-component factory exists outside maintainedComponentFactories.',
          'Every full-component factory must be registered in maintainedComponentFactories.'
        )
      );
    }
  }

  const rootEntries = fs.readdirSync(factoriesRoot, { withFileTypes: true });
  checked += rootEntries.length;
  const actualRootEntries = new Map(
    rootEntries.map((entry) => [
      entry.name,
      entry.isDirectory() ? 'directory' : 'file',
    ])
  );

  for (const [name, expectedKind] of expectedFactoryRootEntries) {
    const actualKind = actualRootEntries.get(name);
    if (actualKind !== expectedKind) {
      findings.push(
        finding(
          'missing-factory-responsibility-entry',
          `packages/tokens/src/factories/${name}`,
          actualKind
            ? `${name} is a ${actualKind}, not the required ${expectedKind}.`
            : `${name} is missing from the factory responsibility root.`,
          `${name} must exist as a ${expectedKind}.`
        )
      );
    }
  }

  for (const [name, actualKind] of actualRootEntries) {
    if (!expectedFactoryRootEntries.has(name)) {
      findings.push(
        finding(
          'unexpected-factory-responsibility-entry',
          `packages/tokens/src/factories/${name}`,
          `${name} is an unclassified ${actualKind} at the factory root.`,
          'Factory-root responsibilities are limited to components, palettes, shared, and index.ts.'
        )
      );
    }
  }

  const paletteFiles = typescriptFiles(palettesRoot);
  checked += paletteFiles.length;
  for (const paletteFile of paletteFiles) {
    const sourcePath = `packages/tokens/src/factories/palettes/${paletteFile}`;
    const match = paletteHelperPattern.exec(paletteFile);
    if (!match) {
      findings.push(
        finding(
          'invalid-palette-helper-classification',
          sourcePath,
          `${paletteFile} does not use the canonical intent-palette helper convention.`,
          'Palette helpers must be narrow create<Component>IntentPalette modules under factories/palettes.'
        )
      );
      continue;
    }

    const componentName = match[1]!;
    const factoryName = `create${componentName}Tokens`;
    if (!maintainedComponentFactories.some(({ name }) => name === factoryName)) {
      findings.push(
        finding(
          'palette-helper-without-canonical-factory',
          sourcePath,
          `${paletteFile} has no matching maintained ${factoryName}.`,
          'Every component-owned intent palette must feed a canonical maintained full-component factory.'
        )
      );
      continue;
    }

    const componentFile = `${lowerFirst(componentName)}.ts`;
    for (const theme of themes) {
      checked += 1;
      const themeSourcePath = `packages/tokens/src/${theme}/components/${componentFile}`;
      const absoluteThemeSource = path.join(root, themeSourcePath);
      if (!fs.existsSync(absoluteThemeSource)) {
        findings.push(
          finding(
            'missing-theme-factory-consumer',
            themeSourcePath,
            `${theme}/${componentFile} is missing for palette-backed ${componentName}.`,
            'Every maintained palette-backed component must have a theme source routed through its canonical full-component factory.'
          )
        );
        continue;
      }

      const source = fs.readFileSync(absoluteThemeSource, 'utf8');
      const canonicalImport = `../../factories/components/${factoryName}.js`;
      if (!source.includes(canonicalImport) || !source.includes(`${factoryName}(`)) {
        findings.push(
          finding(
            'theme-construction-bypasses-canonical-factory',
            themeSourcePath,
            `${theme}/${componentFile} does not import and invoke ${factoryName} through the canonical components directory.`,
            `Import ${canonicalImport} and construct the component through ${factoryName}.`
          )
        );
      }

      if (
        source.includes(`../../factories/${factoryName}.js`) ||
        source.includes(`../../factories/create${componentName}Palette.js`)
      ) {
        findings.push(
          finding(
            'legacy-theme-factory-bypass',
            themeSourcePath,
            `${theme}/${componentFile} still references a legacy root-level factory or palette path.`,
            'Theme construction must use factories/components for full-component factories; palette helpers remain factory internals.'
          )
        );
      }
    }
  }

  const sharedFiles = typescriptFiles(sharedRoot);
  checked += sharedFiles.length;
  for (const sharedFile of sharedFiles) {
    if (!expectedSharedHelpers.has(sharedFile)) {
      findings.push(
        finding(
          'unexpected-shared-factory-helper',
          `packages/tokens/src/factories/shared/${sharedFile}`,
          `${sharedFile} is not a canonical cross-component shared helper.`,
          'Cross-component shared helpers must be explicitly classified.'
        )
      );
    }
  }
  for (const expectedSharedHelper of expectedSharedHelpers) {
    if (!sharedFiles.includes(expectedSharedHelper)) {
      findings.push(
        finding(
          'missing-shared-factory-helper',
          `packages/tokens/src/factories/shared/${expectedSharedHelper}`,
          `${expectedSharedHelper} is missing from the canonical shared responsibility directory.`,
          `${expectedSharedHelper} must remain the explicit shared helper authority.`
        )
      );
    }
  }

  return {
    coverage: 'complete',
    scope:
      'Canonical #887 full-component naming/registration/source parity, exact factory responsibility root, palette-helper classification, explicit shared-helper responsibility, and palette-backed theme construction through canonical full-component factories across Light, Dark, and High Contrast.',
    checked,
    findings,
  };
}
