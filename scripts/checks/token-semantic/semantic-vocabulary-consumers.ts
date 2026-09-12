import fs from 'node:fs';
import path from 'node:path';

import {
  collectThemeCssOutput,
  generateTokenCss,
} from '../../../packages/tokens/scripts/token-css-output';
import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { tokenMigrationManifestV1 } from '../../../packages/tokens/src/preservation/token-migrations';
import type { FindingInput } from './contract';

type DeprecatedSemanticMigration = Extract<
  (typeof tokenMigrationManifestV1)[number],
  { kind: 'rename' | 'remove' }
>;

type WebSemanticIdentityMigration = Extract<
  (typeof tokenMigrationManifestV1)[number],
  { kind: 'representation-change'; layer: 'platform-output' }
> & { to: string };

const sourceRoots = ['apps', 'packages'] as const;
const sourceExtensions = new Set(['.ts', '.tsx', '.css', '.scss']);

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string | null,
  platform: string | null,
  evidence: string,
  expected: string,
  migrationStatus = 'recorded'
): FindingInput {
  return {
    ruleId: 'tokens.semantic-vocabulary',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line: null,
    column: null,
    layer: platform ? 'platform-output' : 'consumer',
    theme: null,
    platform,
    evidence,
    expected,
    migrationStatus,
    suggestedAction:
      'Use the canonical #883 semantic role and its generated Web identity; do not revive a deprecated semantic vocabulary.',
  };
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase();
}

export function semanticPathToCssVariable(tokenPath: string): string {
  const segments = tokenPath.replace(/^semantic\./, '').split('.');
  return `--${segments.map(toKebabCase).join('-')}`;
}

function getSemanticMigrations() {
  const issueMigrations = tokenMigrationManifestV1.filter(
    (migration) => migration.issue === '#883'
  );
  const deprecated = issueMigrations.filter(
    (migration): migration is DeprecatedSemanticMigration =>
      migration.kind === 'rename' || migration.kind === 'remove'
  );
  const webIdentity = issueMigrations.filter(
    (migration): migration is WebSemanticIdentityMigration =>
      migration.kind === 'representation-change' &&
      migration.layer === 'platform-output' &&
      migration.platforms.includes('web') &&
      typeof migration.to === 'string'
  );

  return { deprecated, webIdentity };
}

function listProductionSourceFiles(root: string): string[] {
  const files: string[] = [];

  function visit(relativePath: string) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;

    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      const child = path.posix.join(relativePath, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'coverage' ||
          entry.name === '.next' ||
          entry.name === 'generated' ||
          child === 'packages/tokens/src/preservation'
        ) {
          continue;
        }
        visit(child);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!sourceExtensions.has(path.extname(entry.name))) continue;
      if (
        entry.name.includes('.test.') ||
        entry.name.includes('.stories.') ||
        entry.name.includes('.spec.')
      ) {
        continue;
      }
      files.push(child);
    }
  }

  for (const sourceRoot of sourceRoots) visit(sourceRoot);
  return files.sort();
}

export function auditDeprecatedSemanticConsumerSource(
  sourcePath: string,
  source: string,
  deprecatedPaths?: readonly string[]
): FindingInput[] {
  const paths =
    deprecatedPaths ?? getSemanticMigrations().deprecated.map(({ from }) => from);
  const findings: FindingInput[] = [];

  for (const tokenPath of paths) {
    const cssVariable = semanticPathToCssVariable(tokenPath);
    if (source.includes(tokenPath) || source.includes(cssVariable)) {
      findings.push(
        finding(
          'deprecated-semantic-consumer',
          sourcePath,
          tokenPath,
          null,
          `${sourcePath} still consumes ${tokenPath} or ${cssVariable}.`,
          'Production consumers must select the canonical Semantic Vocabulary V1 role recorded by #883.'
        )
      );
    }
  }

  return findings;
}

export function auditSemanticWebMigrationIdentity(): {
  checked: number;
  findings: FindingInput[];
} {
  const { deprecated, webIdentity } = getSemanticMigrations();
  const findings: FindingInput[] = [];
  let checked = 0;
  const generatedCss = generateTokenCss();
  const themeOutputs = [
    ['light', collectThemeCssOutput(lightTheme)],
    ['dark', collectThemeCssOutput(darkTheme)],
    ['high-contrast', collectThemeCssOutput(highContrastTheme)],
  ] as const;

  const canonicalRenames = deprecated.filter(
    (migration): migration is Extract<DeprecatedSemanticMigration, { kind: 'rename' }> =>
      migration.kind === 'rename'
  );

  for (const rename of canonicalRenames) {
    checked += 1;
    const paired = webIdentity.some(
      (migration) =>
        migration.from === rename.from && migration.to === rename.to
    );
    if (!paired) {
      findings.push(
        finding(
          'semantic-web-migration-pair-missing',
          'packages/tokens/src/preservation/token-migrations.ts',
          rename.from,
          'web',
          `#883 canonical rename ${rename.from} -> ${rename.to} has no matching Web identity migration.`,
          'Every public semantic rename must pair canonical/RN preservation evidence with an explicit Web CSS identity migration.'
        )
      );
    }
  }

  for (const migration of webIdentity) {
    const legacyVariable = semanticPathToCssVariable(migration.from);
    const targetVariable = semanticPathToCssVariable(migration.to);

    checked += 2;
    if (generatedCss.includes(`${legacyVariable}:`)) {
      findings.push(
        finding(
          'deprecated-semantic-css-variable-emitted',
          'packages/tokens/scripts/token-css-output.ts',
          migration.from,
          'web',
          `${legacyVariable} is still emitted after ${migration.id}.`,
          `Generated CSS must emit ${targetVariable} and must not retain the old #883 identity.`
        )
      );
    }
    if (!generatedCss.includes(`${targetVariable}:`)) {
      findings.push(
        finding(
          'semantic-css-rename-target-not-emitted',
          'packages/tokens/scripts/token-css-output.ts',
          migration.to,
          'web',
          `${targetVariable} is missing after ${migration.id}.`,
          'Every #883 Web identity migration target must be present in generated CSS.'
        )
      );
    }

    for (const [themeName, output] of themeOutputs) {
      checked += 3;
      if (output.has(migration.from)) {
        findings.push(
          finding(
            'deprecated-semantic-output-path-present',
            'packages/tokens/scripts/token-css-output.ts',
            migration.from,
            'web',
            `${themeName} output still contains ${migration.from}.`,
            'Theme CSS output maps must expose only the canonical #883 path.'
          )
        );
      }

      const target = output.get(migration.to);
      if (!target) {
        findings.push(
          finding(
            'semantic-output-target-missing',
            'packages/tokens/scripts/token-css-output.ts',
            migration.to,
            'web',
            `${themeName} output does not contain ${migration.to}.`,
            'Every maintained theme must emit the canonical #883 target path.'
          )
        );
      } else if (target.variable !== targetVariable) {
        findings.push(
          finding(
            'semantic-output-variable-identity-drift',
            'packages/tokens/scripts/token-css-output.ts',
            migration.to,
            'web',
            `${themeName} maps ${migration.to} to ${target.variable}.`,
            `The canonical Web identity must be ${targetVariable}.`
          )
        );
      }
    }
  }

  for (const migration of deprecated) {
    checked += 1;
    const legacyVariable = semanticPathToCssVariable(migration.from);
    if (generatedCss.includes(`${legacyVariable}:`)) {
      findings.push(
        finding(
          'removed-semantic-css-identity-emitted',
          'packages/tokens/scripts/token-css-output.ts',
          migration.from,
          'web',
          `${legacyVariable} remains in generated CSS.`,
          'Deprecated #883 semantic identities must not reappear in generated output.'
        )
      );
    }
  }

  return { checked, findings };
}

export function checkTokenSemanticVocabularyCompletion(root: string): {
  checked: number;
  findings: FindingInput[];
} {
  const files = listProductionSourceFiles(root);
  const findings: FindingInput[] = [];
  let checked = files.length;

  for (const sourcePath of files) {
    findings.push(
      ...auditDeprecatedSemanticConsumerSource(
        sourcePath,
        fs.readFileSync(path.join(root, sourcePath), 'utf8')
      )
    );
  }

  const webIdentity = auditSemanticWebMigrationIdentity();
  checked += webIdentity.checked;
  findings.push(...webIdentity.findings);

  return { checked, findings };
}
