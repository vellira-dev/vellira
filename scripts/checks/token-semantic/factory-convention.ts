import fs from 'node:fs';
import path from 'node:path';

import { componentTokenFactoryConventionV1 } from '../../../packages/tokens/src/component-token-factory-conventions';
import { maintainedComponentFactories } from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

const themes = ['light', 'dark', 'highContrast'] as const;
const factoryNamePattern = /^create[A-Z][A-Za-z0-9]*Tokens$/;

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
      'Restore the canonical #887 factory responsibility inventory and route theme construction through the canonical full-component factory.',
  };
}

function typescriptFiles(directory: string) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
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
  const expectedRootEntries = new Map(
    componentTokenFactoryConventionV1.rootEntries.map(({ name, kind }) => [
      name,
      kind,
    ])
  );

  for (const [name, expectedKind] of expectedRootEntries) {
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
    if (expectedRootEntries.has(name)) continue;

    const sourcePath = `packages/tokens/src/factories/${name}`;
    if (
      actualKind === 'file' &&
      /^create[A-Z][A-Za-z0-9]*Tokens\.ts$/.test(name)
    ) {
      findings.push(
        finding(
          'root-factory-bypass',
          sourcePath,
          `${name} bypasses the canonical components responsibility directory.`,
          'Full-component factories belong under factories/components.'
        )
      );
      continue;
    }

    findings.push(
      finding(
        'unexpected-factory-responsibility-entry',
        sourcePath,
        `${name} is an unclassified ${actualKind} at the factory root.`,
        'Factory-root responsibilities must match componentTokenFactoryConventionV1.'
      )
    );
  }

  const paletteFiles = typescriptFiles(palettesRoot);
  checked += paletteFiles.length;
  const expectedPaletteFiles = new Set(
    componentTokenFactoryConventionV1.paletteFamilies.map(({ helper }) => helper)
  );

  for (const paletteFile of paletteFiles) {
    if (!expectedPaletteFiles.has(paletteFile as never)) {
      findings.push(
        finding(
          'invalid-palette-helper-classification',
          `packages/tokens/src/factories/palettes/${paletteFile}`,
          `${paletteFile} is not registered in the canonical #887 palette inventory.`,
          'Palette helpers must be explicitly registered in componentTokenFactoryConventionV1.'
        )
      );
    }
  }

  for (const family of componentTokenFactoryConventionV1.paletteFamilies) {
    checked += 1;
    const sourcePath = `packages/tokens/src/factories/palettes/${family.helper}`;
    if (!paletteFiles.includes(family.helper)) {
      findings.push(
        finding(
          'missing-palette-helper',
          sourcePath,
          `${family.helper} is registered in #887 but missing from factories/palettes.`,
          sourcePath
        )
      );
    }

    if (!maintainedComponentFactories.some(({ name }) => name === family.factory)) {
      findings.push(
        finding(
          'palette-helper-without-canonical-factory',
          sourcePath,
          `${family.helper} points at non-maintained ${family.factory}.`,
          'Every component-owned intent palette must feed a canonical maintained full-component factory.'
        )
      );
    }

    for (const theme of themes) {
      checked += 1;
      const themeSourcePath = `packages/tokens/src/${theme}/components/${family.themeFile}`;
      const absoluteThemeSource = path.join(root, themeSourcePath);
      if (!fs.existsSync(absoluteThemeSource)) {
        findings.push(
          finding(
            'missing-theme-factory-consumer',
            themeSourcePath,
            `${theme}/${family.themeFile} is missing for palette-backed ${family.component}.`,
            'Every registered palette-backed component must have a theme source routed through its canonical full-component factory.'
          )
        );
        continue;
      }

      const source = fs.readFileSync(absoluteThemeSource, 'utf8');
      const canonicalImport = `../../factories/components/${family.factory}.js`;
      if (!source.includes(canonicalImport) || !source.includes(`${family.factory}(`)) {
        findings.push(
          finding(
            'theme-construction-bypasses-canonical-factory',
            themeSourcePath,
            `${theme}/${family.themeFile} does not import and invoke ${family.factory} through the canonical components directory.`,
            `Import ${canonicalImport} and construct the component through ${family.factory}.`
          )
        );
      }

      if (
        source.includes(`../../factories/${family.factory}.js`) ||
        source.includes(
          `../../factories/create${family.componentName}Palette.js`
        )
      ) {
        findings.push(
          finding(
            'legacy-theme-factory-bypass',
            themeSourcePath,
            `${theme}/${family.themeFile} still references a legacy root-level factory or palette path.`,
            'Theme construction must use factories/components for full-component factories; palette helpers remain factory internals.'
          )
        );
      }
    }
  }

  const sharedFiles = typescriptFiles(sharedRoot);
  checked += sharedFiles.length;
  const expectedSharedHelpers = new Set<string>(
    componentTokenFactoryConventionV1.sharedHelpers
  );
  for (const sharedFile of sharedFiles) {
    if (!expectedSharedHelpers.has(sharedFile)) {
      findings.push(
        finding(
          'unexpected-shared-factory-helper',
          `packages/tokens/src/factories/shared/${sharedFile}`,
          `${sharedFile} is not registered as a canonical cross-component shared helper.`,
          'Cross-component shared helpers must be explicitly registered in componentTokenFactoryConventionV1.'
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
          `${expectedSharedHelper} is registered in #887 but missing from the canonical shared responsibility directory.`,
          `${expectedSharedHelper} must remain the explicit shared helper authority.`
        )
      );
    }
  }

  return {
    coverage: 'complete',
    scope:
      'Canonical #887 full-component naming/registration/source parity plus the shared componentTokenFactoryConventionV1 authority for exact factory-root responsibilities, palette helpers, shared helpers, and palette-backed theme construction across Light, Dark, and High Contrast.',
    checked,
    findings,
  };
}
