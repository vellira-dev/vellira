import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { TokenMigrationEntry } from '../../../packages/tokens/src/preservation/token-migrations';
import { tokenMigrationManifestV1 } from '../../../packages/tokens/src/preservation/token-migrations';
import { formatGeneratedContent } from '../format-generated-files';
import { readTokenLifecycleAuthority } from '../../token-lifecycle/authority';

import { getGeneratedComponentTokenLogicalPaths } from './component-token-logical-paths';
import type { ComponentGenerationPlan } from './plan';
import {
  assertGovernedWorkItemMatchesRepository,
  parseGovernedGitHubWorkItem,
} from './work-item';

type AdditionMigration = Extract<TokenMigrationEntry, { kind: 'addition' }>;

type PreservationBaseline = {
  schemaVersion: number;
  themes: Record<string, { entries: Record<string, string> }>;
  platformOutputs: {
    web: Record<string, { entries: Record<string, string> }>;
  };
};

export type ManagedComponentTokenAddition = {
  id: string;
  kind: 'addition';
  issue: `#${number}`;
  reason: string;
  to: string;
};

type PreservationAnalysis = {
  manifestFile: string;
  source: string;
  managedEntries: ManagedComponentTokenAddition[];
  missingPaths: string[];
  lifecycleStatus: 'reserved' | 'current';
};

export type ComponentTokenPreservationMutationResult = {
  updatedFiles: string[];
};

const managedVariableName = 'generatedComponentTokenAdditionMigrationsV1';
const generatedReason =
  'Authorize a first-materialized canonical component-token leaf produced by Generator V2.';
const logicalPathPattern = /^components\.[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/;
const issuePattern = /^#[1-9][0-9]*$/;

function isCanonicalIssue(value: string): value is `#${number}` {
  return (
    issuePattern.test(value) &&
    Number.isSafeInteger(Number(value.slice(1))) &&
    Number(value.slice(1)) > 0
  );
}

export function getTokenMigrationManifestFile(root: string): string {
  return path.join(
    root,
    'packages',
    'tokens',
    'src',
    'preservation',
    'token-migrations.ts'
  );
}

export function getTokenPreservationBaselineFile(root: string): string {
  return path.join(
    root,
    'packages',
    'tokens',
    'src',
    'preservation',
    'token-preservation-baseline.v1.json'
  );
}

function generatedMigrationId(issue: `#${number}`, tokenPath: string): string {
  return `${issue.slice(1)}-generator-v2-component-token-addition-${tokenPath.replaceAll('.', '-')}`;
}

export function createGeneratedComponentTokenAddition(params: {
  issue: `#${number}`;
  to: string;
}): ManagedComponentTokenAddition {
  if (!isCanonicalIssue(params.issue)) {
    throw new Error(
      'component-token-preservation-provenance-invalid: issue must use canonical #<number> form'
    );
  }

  if (!logicalPathPattern.test(params.to)) {
    throw new Error(`component-token-preservation-path-invalid: ${params.to}`);
  }

  return {
    id: generatedMigrationId(params.issue, params.to),
    kind: 'addition',
    issue: params.issue,
    reason: generatedReason,
    to: params.to,
  };
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function stringProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string
): string {
  const matches = object.properties.filter(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) &&
        property.name.text === propertyName) ||
        (ts.isStringLiteral(property.name) &&
          property.name.text === propertyName))
  );

  if (matches.length !== 1) {
    throw new Error(
      `component-token-preservation-managed-entry-invalid: expected one ${propertyName} property`
    );
  }

  const initializer = unwrapExpression(matches[0].initializer);

  if (!ts.isStringLiteral(initializer)) {
    throw new Error(
      `component-token-preservation-managed-entry-invalid: ${propertyName} must be a string literal`
    );
  }

  return initializer.text;
}

function parseManagedEntry(
  element: ts.Expression
): ManagedComponentTokenAddition {
  const expression = unwrapExpression(element);

  if (!ts.isObjectLiteralExpression(expression)) {
    throw new Error(
      'component-token-preservation-managed-entry-invalid: entries must be object literals'
    );
  }

  if (
    expression.properties.length !== 5 ||
    expression.properties.some((property) =>
      ts.isPropertyAssignment(property)
        ? !['id', 'kind', 'issue', 'reason', 'to'].includes(
            ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
              ? property.name.text
              : ''
          )
        : true
    )
  ) {
    throw new Error(
      'component-token-preservation-managed-entry-invalid: entries must contain exactly id, kind, issue, reason, and to'
    );
  }

  const entry = {
    id: stringProperty(expression, 'id'),
    kind: stringProperty(expression, 'kind'),
    issue: stringProperty(expression, 'issue'),
    reason: stringProperty(expression, 'reason'),
    to: stringProperty(expression, 'to'),
  };

  if (entry.kind !== 'addition' || !isCanonicalIssue(entry.issue)) {
    throw new Error(
      'component-token-preservation-managed-entry-invalid: only governed addition entries are allowed'
    );
  }

  const expected = createGeneratedComponentTokenAddition({
    issue: entry.issue,
    to: entry.to,
  });

  if (
    entry.id !== expected.id ||
    entry.reason !== expected.reason ||
    entry.kind !== expected.kind
  ) {
    throw new Error(
      `component-token-preservation-managed-entry-drift: ${entry.to}`
    );
  }

  return expected;
}

function findManagedArray(
  source: string,
  filePath: string
): {
  array: ts.ArrayLiteralExpression;
  entries: ManagedComponentTokenAddition[];
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const matches: ts.VariableDeclaration[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === managedVariableName
      ) {
        matches.push(declaration);
      }
    }
  }

  if (matches.length !== 1 || !matches[0].initializer) {
    throw new Error(
      `component-token-preservation-managed-authority-invalid: expected exactly one ${managedVariableName} declaration`
    );
  }

  const initializer = unwrapExpression(matches[0].initializer);

  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(
      `component-token-preservation-managed-authority-invalid: ${managedVariableName} must be an array literal`
    );
  }

  const entries = initializer.elements.map(parseManagedEntry);
  const ids = entries.map((entry) => entry.id);
  const paths = entries.map((entry) => entry.to);

  if (
    new Set(ids).size !== ids.length ||
    new Set(paths).size !== paths.length
  ) {
    throw new Error(
      'component-token-preservation-managed-authority-invalid: duplicate generated migration identity or path'
    );
  }

  const sorted = [...entries].sort((left, right) =>
    left.to.localeCompare(right.to, 'en')
  );

  if (entries.some((entry, index) => entry.to !== sorted[index]?.to)) {
    throw new Error(
      'component-token-preservation-managed-authority-invalid: generated entries must use canonical token-path ordering'
    );
  }

  return { array: initializer, entries };
}

export function readGeneratedComponentTokenAdditions(
  root: string
): readonly ManagedComponentTokenAddition[] {
  const manifestFile = getTokenMigrationManifestFile(root);

  return findManagedArray(fs.readFileSync(manifestFile, 'utf8'), manifestFile)
    .entries;
}

function readBaseline(root: string): PreservationBaseline {
  const baselineFile = getTokenPreservationBaselineFile(root);

  if (!fs.existsSync(baselineFile)) {
    throw new Error(
      `component-token-preservation-baseline-missing: ${path.relative(root, baselineFile)}`
    );
  }

  let value: unknown;

  try {
    value = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  } catch (error) {
    throw new Error(
      `component-token-preservation-baseline-invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('themes' in value) ||
    typeof value.themes !== 'object' ||
    value.themes === null ||
    !('platformOutputs' in value) ||
    typeof value.platformOutputs !== 'object' ||
    value.platformOutputs === null ||
    !('web' in value.platformOutputs) ||
    typeof value.platformOutputs.web !== 'object' ||
    value.platformOutputs.web === null
  ) {
    throw new Error(
      'component-token-preservation-baseline-invalid: expected schemaVersion 1 canonical and Web snapshots'
    );
  }

  return value as PreservationBaseline;
}

function baselinePresence(
  baseline: PreservationBaseline,
  tokenPath: string
): 'present' | 'absent' {
  const snapshots = [
    ...Object.values(baseline.themes),
    ...Object.values(baseline.platformOutputs.web),
  ];

  if (snapshots.length === 0) {
    throw new Error(
      'component-token-preservation-baseline-invalid: no preservation snapshots'
    );
  }

  const presence = snapshots.map(
    (snapshot) =>
      typeof snapshot === 'object' &&
      snapshot !== null &&
      typeof snapshot.entries === 'object' &&
      snapshot.entries !== null &&
      Object.hasOwn(snapshot.entries, tokenPath)
  );

  if (presence.every(Boolean)) return 'present';
  if (presence.every((value) => !value)) return 'absent';

  throw new Error(
    `component-token-preservation-baseline-partial-family: ${tokenPath}`
  );
}

function uniqueAdditions(
  managedEntries: readonly ManagedComponentTokenAddition[]
): AdditionMigration[] {
  const additions = [
    ...(tokenMigrationManifestV1 as readonly TokenMigrationEntry[]).filter(
      (entry): entry is AdditionMigration => entry.kind === 'addition'
    ),
    ...managedEntries,
  ];
  const seen = new Set<string>();

  return additions.filter((entry) => {
    const identity = JSON.stringify(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function analyzeComponentTokenPreservation(
  plan: ComponentGenerationPlan
): PreservationAnalysis | null {
  if (plan.componentTokens === false) return null;

  const manifestFile = getTokenMigrationManifestFile(plan.root);

  if (!fs.existsSync(manifestFile)) {
    throw new Error(
      `component-token-preservation-manifest-missing: ${path.relative(plan.root, manifestFile)}`
    );
  }

  const source = fs.readFileSync(manifestFile, 'utf8');
  const managedEntries = findManagedArray(source, manifestFile).entries;
  const baseline = readBaseline(plan.root);
  const lifecycle = readTokenLifecycleAuthority(plan.root).components[
    plan.componentName
  ];

  if (lifecycle?.status !== 'reserved' && lifecycle?.status !== 'current') {
    throw new Error(
      `component-token-preservation-lifecycle-invalid: component=${plan.componentName}`
    );
  }

  const paths = getGeneratedComponentTokenLogicalPaths({
    componentName: plan.componentName,
    componentTokens: plan.componentTokens,
  });
  const additions = uniqueAdditions(managedEntries);
  const missingPaths: string[] = [];

  for (const tokenPath of paths) {
    const matching = additions.filter((entry) => entry.to === tokenPath);

    if (
      matching.some(
        (entry) => entry.themes !== undefined || entry.platforms !== undefined
      )
    ) {
      throw new Error(
        `component-token-preservation-addition-scope-invalid: ${tokenPath} must use one logical unscoped addition authority`
      );
    }

    if (matching.length > 1) {
      throw new Error(
        `component-token-preservation-addition-ambiguous: ${tokenPath}`
      );
    }

    const presence = baselinePresence(baseline, tokenPath);

    if (presence === 'present') {
      if (matching.length > 0) {
        throw new Error(
          `component-token-preservation-addition-invalid: ${tokenPath} already exists in the immutable baseline`
        );
      }
      continue;
    }

    if (matching.length === 0) {
      missingPaths.push(tokenPath);
    }
  }

  if (plan.workItem !== undefined) {
    const workItem = parseGovernedGitHubWorkItem(plan.workItem);
    assertGovernedWorkItemMatchesRepository({ root: plan.root, workItem });

    for (const entry of managedEntries.filter((candidate) =>
      paths.includes(candidate.to)
    )) {
      if (entry.issue !== workItem.issue) {
        throw new Error(
          `component-token-preservation-provenance-drift: ${entry.to} is bound to ${entry.issue}, expected ${workItem.issue}`
        );
      }
    }
  }

  if (missingPaths.length > 0 && plan.workItem === undefined) {
    throw new Error(
      `component-token-preservation-provenance-required: ${plan.componentName} requires an exact governed GitHub work item before first materialization`
    );
  }

  return {
    manifestFile,
    source,
    managedEntries,
    missingPaths,
    lifecycleStatus: lifecycle.status,
  };
}

export function assertComponentTokenPreservationCanMaterialize(
  plan: ComponentGenerationPlan
): void {
  analyzeComponentTokenPreservation(plan);
}

export function getPlannedComponentTokenPreservationArtifacts(
  plan: ComponentGenerationPlan
): string[] {
  const analysis = analyzeComponentTokenPreservation(plan);

  return analysis && analysis.missingPaths.length > 0
    ? [analysis.manifestFile]
    : [];
}

export function checkComponentTokenPreservationContract(
  plan: ComponentGenerationPlan
): string[] {
  const analysis = analyzeComponentTokenPreservation(plan);

  return analysis && analysis.missingPaths.length > 0
    ? [path.relative(plan.root, analysis.manifestFile)]
    : [];
}

function renderManagedArray(
  entries: readonly ManagedComponentTokenAddition[]
): string {
  return JSON.stringify(entries, null, 2);
}

export async function synchronizeComponentTokenPreservationContract(params: {
  plan: ComponentGenerationPlan;
  result: ComponentTokenPreservationMutationResult;
}): Promise<void> {
  const analysis = analyzeComponentTokenPreservation(params.plan);

  if (!analysis || analysis.missingPaths.length === 0) return;

  if (analysis.lifecycleStatus !== 'reserved') {
    throw new Error(
      `component-token-preservation-evidence-missing: ${params.plan.componentName} is already current and cannot retroactively create first-materialization evidence`
    );
  }

  const workItem = parseGovernedGitHubWorkItem(params.plan.workItem);
  const additions = analysis.missingPaths.map((to) =>
    createGeneratedComponentTokenAddition({ issue: workItem.issue, to })
  );
  const nextEntries = [...analysis.managedEntries, ...additions].sort(
    (left, right) => left.to.localeCompare(right.to, 'en')
  );
  const managed = findManagedArray(analysis.source, analysis.manifestFile);
  const nextSource = `${analysis.source.slice(
    0,
    managed.array.getStart()
  )}${renderManagedArray(nextEntries)}${analysis.source.slice(managed.array.end)}`;
  const formatted = await formatGeneratedContent(
    analysis.manifestFile,
    nextSource
  );

  fs.writeFileSync(analysis.manifestFile, formatted);

  const verified = findManagedArray(formatted, analysis.manifestFile).entries;

  if (JSON.stringify(verified) !== JSON.stringify(nextEntries)) {
    throw new Error(
      'component-token-preservation-synchronization-failed: written managed evidence did not verify'
    );
  }

  if (!params.result.updatedFiles.includes(analysis.manifestFile)) {
    params.result.updatedFiles.push(analysis.manifestFile);
  }
}
