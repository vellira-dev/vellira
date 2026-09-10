import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import { tokenMigrationManifestV1 } from '../../../packages/tokens/src/preservation/token-migrations';
import {
  canonicalSemanticRolePaths,
  semanticVocabularyV1,
} from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

type SemanticMigration = {
  kind: 'rename' | 'remove';
  issue: string;
  from: string;
  to?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasSemanticPath(semantic: unknown, tokenPath: string): boolean {
  const segments = tokenPath.replace(/^semantic\./, '').split('.');
  let current: unknown = semantic;

  for (const segment of segments) {
    const record = asRecord(current);
    if (!record || !(segment in record)) return false;
    current = record[segment];
  }

  return true;
}

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string,
  theme: string | null,
  evidence: string,
  expected: string,
  migrationStatus: string
): FindingInput {
  return {
    ruleId: 'tokens.semantic-vocabulary',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line: null,
    column: null,
    layer: 'semantic',
    theme,
    platform: null,
    evidence,
    expected,
    migrationStatus,
    suggestedAction:
      'Restore the canonical #883 semantic role or complete its recorded migration.',
  };
}

export function getSemanticVocabularyRolePaths(): string[] {
  const paths: string[] = [];

  for (const [namespace, descriptor] of Object.entries(semanticVocabularyV1)) {
    const record = descriptor as {
      roles: readonly string[];
      intents?: readonly string[];
      states?: readonly string[];
    };

    if (record.intents) {
      for (const intent of record.intents) {
        for (const role of record.roles) {
          paths.push(`semantic.${namespace}.${intent}.${role}`);
        }
      }
      continue;
    }

    if (record.states) {
      for (const role of record.roles) {
        for (const state of record.states) {
          paths.push(`semantic.${namespace}.${role}.${state}`);
        }
      }
      continue;
    }

    for (const role of record.roles) {
      paths.push(`semantic.${namespace}.${role}`);
    }
  }

  return paths.sort();
}

export function auditSemanticMigrationPaths(
  semantic: unknown,
  migrations: readonly SemanticMigration[],
  theme: string | null,
  sourcePath: string
): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const migration of migrations) {
    if (hasSemanticPath(semantic, migration.from)) {
      findings.push(
        finding(
          'deprecated-semantic-path-present',
          sourcePath,
          migration.from,
          theme,
          `${migration.from} still exists after ${migration.issue} ${migration.kind}.`,
          'The recorded legacy semantic path must be absent.',
          'recorded'
        )
      );
    }

    if (
      migration.kind === 'rename' &&
      migration.to &&
      !hasSemanticPath(semantic, migration.to)
    ) {
      findings.push(
        finding(
          'semantic-rename-target-missing',
          sourcePath,
          migration.to,
          theme,
          `${migration.to} is missing for ${migration.issue} rename from ${migration.from}.`,
          'The recorded canonical rename target must exist.',
          'recorded'
        )
      );
    }
  }

  return findings;
}

function auditTheme(
  themeName: string,
  directory: string,
  semantic: unknown,
  declaredPaths: readonly string[],
  migrations: readonly SemanticMigration[]
): { checked: number; findings: FindingInput[] } {
  const sourcePath = `packages/tokens/src/${directory}/theme.ts`;
  const findings: FindingInput[] = [];
  let checked = 0;

  for (const tokenPath of declaredPaths) {
    checked += 1;
    if (!hasSemanticPath(semantic, tokenPath)) {
      findings.push(
        finding(
          'declared-semantic-role-missing',
          sourcePath,
          tokenPath,
          themeName,
          `${tokenPath} is declared by semanticVocabularyV1 but missing from the theme.`,
          'Every declared Semantic Vocabulary V1 role must exist in every maintained theme.',
          'not-applicable'
        )
      );
    }
  }

  for (const rolePath of canonicalSemanticRolePaths) {
    const tokenPath = `semantic.${rolePath}`;
    checked += 1;
    if (!hasSemanticPath(semantic, tokenPath)) {
      findings.push(
        finding(
          'canonical-semantic-role-missing',
          sourcePath,
          tokenPath,
          themeName,
          `${tokenPath} is listed by canonicalSemanticRolePaths but missing from the theme.`,
          'Every canonical semantic role path must resolve in every maintained theme.',
          'not-applicable'
        )
      );
    }
  }

  checked += migrations.reduce(
    (total, migration) => total + (migration.kind === 'rename' ? 2 : 1),
    0
  );
  findings.push(
    ...auditSemanticMigrationPaths(semantic, migrations, themeName, sourcePath)
  );

  return { checked, findings };
}

export function checkTokenSemanticVocabulary(): RuleResult {
  const findings: FindingInput[] = [];
  let checked = 0;
  const declaredPaths = getSemanticVocabularyRolePaths();
  const migrations = tokenMigrationManifestV1.filter(
    (migration): migration is (typeof tokenMigrationManifestV1)[number] &
      SemanticMigration =>
      migration.issue === '#883' &&
      (migration.kind === 'rename' || migration.kind === 'remove')
  );

  for (const [namespace, descriptor] of Object.entries(semanticVocabularyV1)) {
    checked += 2;
    if (!descriptor.purpose.trim()) {
      findings.push(
        finding(
          'semantic-namespace-purpose-missing',
          'packages/tokens/src/token-architecture.ts',
          `semantic.${namespace}`,
          null,
          `${namespace} has no machine-readable purpose.`,
          'Every Semantic Vocabulary V1 namespace must document its purpose.',
          'not-applicable'
        )
      );
    }
    if (descriptor.roles.length === 0) {
      findings.push(
        finding(
          'semantic-namespace-roles-empty',
          'packages/tokens/src/token-architecture.ts',
          `semantic.${namespace}`,
          null,
          `${namespace} declares no roles.`,
          'Every Semantic Vocabulary V1 namespace must declare at least one role.',
          'not-applicable'
        )
      );
    }
  }

  const themes = [
    ['light', 'light', lightTheme.semantic],
    ['dark', 'dark', darkTheme.semantic],
    ['high-contrast', 'highContrast', highContrastTheme.semantic],
  ] as const;

  for (const [themeName, directory, semantic] of themes) {
    const result = auditTheme(
      themeName,
      directory,
      semantic,
      declaredPaths,
      migrations
    );
    checked += result.checked;
    findings.push(...result.findings);
  }

  return {
    coverage: 'partial',
    scope:
      'Semantic Vocabulary V1 declared roles, canonical semantic role paths, and #883 rename/removal migrations across Light, Dark, and High Contrast. Lifecycle authority remains owned by tokens.namespace-lifecycle; consumer-purpose correctness and generated CSS migration identity remain to be connected.',
    checked,
    findings,
  };
}
