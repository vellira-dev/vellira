import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { generatedComponentFactoryArchitectureV1 } from '../../../packages/tokens/src/generated-component-factory-architecture';
import type { GeneratedComponentFactoryArchitectureRegistration } from '../../../packages/tokens/src/generated-component-factory-architecture';
import { componentTokenDependencyAuditV1 } from '../../../packages/tokens/src/component-token-dependencies';
import { maintainedComponentFactories } from '../../../packages/tokens/src/token-architecture';
import { formatGeneratedContent } from '../format-generated-files';

import { getGeneratedComponentTokenFactoryStateKeys } from './component-token-logical-paths';
import type { ComponentGenerationPlan } from './plan';
import { renderThemeComponentTokensTemplate } from './templates';
import { generatedThemeTokenDependencyAudit } from './token-dependency-contract';

export type GeneratedRegistration = {
  componentTokens: 'standard' | 'boolean-control' | 'disclosure';
  factory: {
    name: string;
    source: string;
    semanticAdapter: string;
    stateKeys: string[];
  };
  dependencyAudit: {
    factory: string;
    component: string;
    file: string;
    primitiveColorUsage: ['none'];
    unresolved: [];
  };
};

type RegistrationAnalysis = {
  file: string;
  source: string;
  entries: GeneratedRegistration[];
  nextEntries: GeneratedRegistration[];
  mutationRequired: boolean;
};

export type ComponentTokenArchitectureMutationResult = {
  updatedFiles: string[];
};

const authorityVariableName = 'generatedComponentFactoryArchitectureV1';
const componentNamePattern = /^[A-Z][A-Za-z0-9]*$/;

function lowerCamel(componentName: string): string {
  return `${componentName[0]!.toLowerCase()}${componentName.slice(1)}`;
}

export function getComponentTokenArchitectureRegistrationFile(
  root: string
): string {
  return path.join(
    root,
    'packages',
    'tokens',
    'src',
    'generated-component-factory-architecture.ts'
  );
}

export function createGeneratedComponentFactoryArchitectureRegistration(
  plan: Pick<ComponentGenerationPlan, 'componentName' | 'componentTokens'>
): GeneratedRegistration | null {
  if (plan.componentTokens === false) return null;

  if (!componentNamePattern.test(plan.componentName)) {
    throw new Error(
      `component-token-architecture-component-invalid: ${plan.componentName}`
    );
  }

  const component = lowerCamel(plan.componentName);
  const factory = `create${plan.componentName}Tokens`;
  const generatedThemeSource = renderThemeComponentTokensTemplate({
    componentName: plan.componentName,
    componentTokens: plan.componentTokens,
  });
  const dependencyFindings =
    generatedThemeTokenDependencyAudit(generatedThemeSource);
  const externalFactories = [
    ...generatedThemeSource.matchAll(
      /factories\/components\/(create[A-Z][A-Za-z0-9]*Tokens)\.js/g
    ),
  ]
    .map((match) => match[1]!)
    .filter((importedFactory) => importedFactory !== factory);

  if (dependencyFindings.length > 0 || externalFactories.length > 0) {
    throw new Error(
      `component-token-architecture-dependency-unresolved: ${factory}`
    );
  }

  return {
    componentTokens: plan.componentTokens,
    factory: {
      name: factory,
      source: `packages/tokens/src/factories/components/${factory}.ts`,
      semanticAdapter: `create${plan.componentName}TokensFromSemantics`,
      stateKeys: getGeneratedComponentTokenFactoryStateKeys(
        plan.componentTokens
      ),
    },
    dependencyAudit: {
      factory,
      component,
      file: `${component}.ts`,
      primitiveColorUsage: ['none'],
      unresolved: [],
    },
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

function property(
  object: ts.ObjectLiteralExpression,
  propertyName: string
): ts.Expression {
  const matches = object.properties.filter(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      (ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) &&
      candidate.name.text === propertyName
  );

  if (matches.length !== 1) {
    throw new Error(
      `component-token-architecture-entry-invalid: expected one ${propertyName} property`
    );
  }

  return unwrapExpression(matches[0].initializer);
}

function exactProperties(
  object: ts.ObjectLiteralExpression,
  expected: readonly string[]
): void {
  const names = object.properties.map((candidate) => {
    if (
      !ts.isPropertyAssignment(candidate) ||
      (!ts.isIdentifier(candidate.name) && !ts.isStringLiteral(candidate.name))
    ) {
      throw new Error(
        'component-token-architecture-entry-invalid: entries require named property assignments'
      );
    }
    return candidate.name.text;
  });

  if (
    names.length !== expected.length ||
    expected.some((name) => !names.includes(name))
  ) {
    throw new Error(
      `component-token-architecture-entry-invalid: expected exactly ${expected.join(', ')}`
    );
  }
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string
): ts.ObjectLiteralExpression {
  const value = property(object, propertyName);
  if (!ts.isObjectLiteralExpression(value)) {
    throw new Error(
      `component-token-architecture-entry-invalid: ${propertyName} must be an object literal`
    );
  }
  return value;
}

function stringProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string
): string {
  const value = property(object, propertyName);
  if (!ts.isStringLiteral(value)) {
    throw new Error(
      `component-token-architecture-entry-invalid: ${propertyName} must be a string literal`
    );
  }
  return value.text;
}

function stringArrayProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string
): string[] {
  const value = property(object, propertyName);
  if (
    !ts.isArrayLiteralExpression(value) ||
    value.elements.some((element) => !ts.isStringLiteral(element))
  ) {
    throw new Error(
      `component-token-architecture-entry-invalid: ${propertyName} must be a string-literal array`
    );
  }
  return value.elements.map((element) => (element as ts.StringLiteral).text);
}

function parseRegistration(element: ts.Expression): GeneratedRegistration {
  const expression = unwrapExpression(element);
  if (!ts.isObjectLiteralExpression(expression)) {
    throw new Error(
      'component-token-architecture-entry-invalid: entries must be object literals'
    );
  }
  exactProperties(expression, [
    'componentTokens',
    'factory',
    'dependencyAudit',
  ]);

  const componentTokens = stringProperty(expression, 'componentTokens');
  if (
    componentTokens !== 'standard' &&
    componentTokens !== 'boolean-control' &&
    componentTokens !== 'disclosure'
  ) {
    throw new Error(
      `component-token-architecture-entry-invalid: unsupported componentTokens ${componentTokens}`
    );
  }

  const factory = objectProperty(expression, 'factory');
  exactProperties(factory, ['name', 'source', 'semanticAdapter', 'stateKeys']);
  const dependencyAudit = objectProperty(expression, 'dependencyAudit');
  exactProperties(dependencyAudit, [
    'factory',
    'component',
    'file',
    'primitiveColorUsage',
    'unresolved',
  ]);

  const primitiveColorUsage = stringArrayProperty(
    dependencyAudit,
    'primitiveColorUsage'
  );
  const unresolved = stringArrayProperty(dependencyAudit, 'unresolved');

  if (
    primitiveColorUsage.length !== 1 ||
    primitiveColorUsage[0] !== 'none' ||
    unresolved.length !== 0
  ) {
    throw new Error(
      'component-token-architecture-entry-invalid: generated dependency evidence must be semantic-only and fully resolved'
    );
  }

  const entry: GeneratedRegistration = {
    componentTokens,
    factory: {
      name: stringProperty(factory, 'name'),
      source: stringProperty(factory, 'source'),
      semanticAdapter: stringProperty(factory, 'semanticAdapter'),
      stateKeys: stringArrayProperty(factory, 'stateKeys'),
    },
    dependencyAudit: {
      factory: stringProperty(dependencyAudit, 'factory'),
      component: stringProperty(dependencyAudit, 'component'),
      file: stringProperty(dependencyAudit, 'file'),
      primitiveColorUsage: ['none'],
      unresolved: [],
    },
  };

  const componentName = entry.factory.name.match(
    /^create([A-Z][A-Za-z0-9]*)Tokens$/
  )?.[1];
  const expected = componentName
    ? createGeneratedComponentFactoryArchitectureRegistration({
        componentName,
        componentTokens,
      })
    : null;

  if (!expected || JSON.stringify(entry) !== JSON.stringify(expected)) {
    throw new Error(
      `component-token-architecture-entry-drift: ${entry.factory.name}`
    );
  }

  return entry;
}

function findAuthorityArray(source: string, file: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const matches = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === authorityVariableName
    );

  if (matches.length !== 1 || !matches[0]!.initializer) {
    throw new Error(
      `component-token-architecture-authority-invalid: expected exactly one ${authorityVariableName}`
    );
  }

  const initializer = unwrapExpression(matches[0]!.initializer!);
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(
      `component-token-architecture-authority-invalid: ${authorityVariableName} must be an array literal`
    );
  }

  const entries = initializer.elements.map(parseRegistration);
  const names = entries.map(({ factory }) => factory.name);
  const components = entries.map(
    ({ dependencyAudit }) => dependencyAudit.component
  );
  const sortedNames = [...names].sort((left, right) =>
    left.localeCompare(right, 'en')
  );

  if (
    new Set(names).size !== names.length ||
    new Set(components).size !== components.length ||
    names.some((name, index) => name !== sortedNames[index])
  ) {
    throw new Error(
      'component-token-architecture-authority-invalid: generated registrations must be unique and factory-sorted'
    );
  }

  return { array: initializer, entries };
}

export function readGeneratedComponentFactoryArchitectureRegistrations(
  root: string
): readonly GeneratedRegistration[] {
  const file = getComponentTokenArchitectureRegistrationFile(root);
  if (!fs.existsSync(file)) {
    throw new Error(
      `component-token-architecture-authority-missing: ${path.relative(root, file)}`
    );
  }
  return findAuthorityArray(fs.readFileSync(file, 'utf8'), file).entries;
}

function historicalFactories() {
  const generatedRegistrations =
    generatedComponentFactoryArchitectureV1 as readonly GeneratedComponentFactoryArchitectureRegistration[];
  const generatedNames = new Set(
    generatedRegistrations.map(({ factory }) => factory.name)
  );
  return maintainedComponentFactories.filter(
    ({ name }) => !generatedNames.has(name)
  );
}

function historicalDependencyAudits() {
  const generatedRegistrations =
    generatedComponentFactoryArchitectureV1 as readonly GeneratedComponentFactoryArchitectureRegistration[];
  const generatedNames = new Set(
    generatedRegistrations.map(({ factory }) => factory.name)
  );
  return componentTokenDependencyAuditV1.filter(
    ({ factory }) => !generatedNames.has(factory)
  );
}

function assertNoHistoricalRegistrationOverlap(
  entries: readonly GeneratedRegistration[]
): void {
  const historicalFactoryNames = new Set(
    historicalFactories().map(({ name }) => name)
  );
  const historicalComponents = new Set(
    historicalDependencyAudits().map(({ component }) => String(component))
  );

  for (const entry of entries) {
    if (
      historicalFactoryNames.has(entry.factory.name) ||
      historicalComponents.has(entry.dependencyAudit.component)
    ) {
      throw new Error(
        `component-token-architecture-authority-ambiguous: ${entry.factory.name} overlaps a historical #887/#888 registration`
      );
    }
  }
}

function assertHistoricalIdentity(expected: GeneratedRegistration): boolean {
  const factories = historicalFactories().filter(
    ({ name }) => name === expected.factory.name
  );
  const dependencies = historicalDependencyAudits().filter(
    ({ factory }) => factory === expected.factory.name
  );

  if (factories.length === 0 && dependencies.length === 0) return false;
  if (factories.length !== 1 || dependencies.length !== 1) {
    throw new Error(
      `component-token-architecture-authority-ambiguous: ${expected.factory.name}`
    );
  }

  const factory = factories[0]!;
  const dependency = dependencies[0]!;
  if (
    factory.source !== expected.factory.source ||
    dependency.component !== expected.dependencyAudit.component ||
    dependency.file !== expected.dependencyAudit.file
  ) {
    throw new Error(
      `component-token-architecture-historical-identity-drift: ${expected.factory.name}`
    );
  }

  return true;
}

export async function analyzeComponentTokenArchitectureRegistration(
  plan: Pick<
    ComponentGenerationPlan,
    'root' | 'componentName' | 'componentTokens'
  >
): Promise<RegistrationAnalysis> {
  const file = getComponentTokenArchitectureRegistrationFile(plan.root);
  if (!fs.existsSync(file)) {
    throw new Error(
      `component-token-architecture-authority-missing: ${path.relative(plan.root, file)}`
    );
  }

  const source = fs.readFileSync(file, 'utf8');
  const authority = findAuthorityArray(source, file);
  assertNoHistoricalRegistrationOverlap(authority.entries);
  const expected =
    createGeneratedComponentFactoryArchitectureRegistration(plan);

  if (!expected) {
    return {
      file,
      source,
      entries: authority.entries,
      nextEntries: authority.entries,
      mutationRequired: false,
    };
  }

  const matches = authority.entries.filter(
    ({ factory }) => factory.name === expected.factory.name
  );
  if (matches.length > 1) {
    throw new Error(
      `component-token-architecture-authority-ambiguous: ${expected.factory.name}`
    );
  }
  if (matches.length === 1) {
    if (JSON.stringify(matches[0]) !== JSON.stringify(expected)) {
      throw new Error(
        `component-token-architecture-registration-drift: ${expected.factory.name}`
      );
    }
    return {
      file,
      source,
      entries: authority.entries,
      nextEntries: authority.entries,
      mutationRequired: false,
    };
  }

  if (assertHistoricalIdentity(expected)) {
    return {
      file,
      source,
      entries: authority.entries,
      nextEntries: authority.entries,
      mutationRequired: false,
    };
  }

  const nextEntries = [...authority.entries, expected].sort((left, right) =>
    left.factory.name.localeCompare(right.factory.name, 'en')
  );

  return {
    file,
    source,
    entries: authority.entries,
    nextEntries,
    mutationRequired: true,
  };
}

export async function checkComponentTokenArchitectureRegistration(
  plan: Pick<
    ComponentGenerationPlan,
    'root' | 'componentName' | 'componentTokens'
  >
): Promise<string[]> {
  const analysis = await analyzeComponentTokenArchitectureRegistration(plan);
  return analysis.mutationRequired
    ? [path.relative(plan.root, analysis.file)]
    : [];
}

export async function synchronizeComponentTokenArchitectureRegistration(params: {
  plan: Pick<
    ComponentGenerationPlan,
    'root' | 'componentName' | 'componentTokens'
  >;
  result: ComponentTokenArchitectureMutationResult;
}): Promise<void> {
  const analysis = await analyzeComponentTokenArchitectureRegistration(
    params.plan
  );
  if (!analysis.mutationRequired) return;

  const authority = findAuthorityArray(analysis.source, analysis.file);
  const nextSource = `${analysis.source.slice(
    0,
    authority.array.getStart()
  )}${JSON.stringify(analysis.nextEntries, null, 2)}${analysis.source.slice(
    authority.array.end
  )}`;
  const formatted = await formatGeneratedContent(analysis.file, nextSource);
  fs.writeFileSync(analysis.file, formatted);

  const verified = findAuthorityArray(formatted, analysis.file).entries;
  if (JSON.stringify(verified) !== JSON.stringify(analysis.nextEntries)) {
    throw new Error(
      'component-token-architecture-synchronization-failed: written authority did not verify'
    );
  }

  if (!params.result.updatedFiles.includes(analysis.file)) {
    params.result.updatedFiles.push(analysis.file);
  }
}
