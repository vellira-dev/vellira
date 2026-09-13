import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { componentMetadata } from '../../../packages/metadata/src/components';
import { createSemanticShadowTokens } from '../../../packages/tokens/src/effects/shadow-system';
import {
  canonicalSemanticRolePaths,
  semanticVocabularyV1,
} from '../../../packages/tokens/src/token-architecture';
import { readTokenLifecycleAuthority } from '../../token-lifecycle/authority';
import { auditComponentTokenOwnershipParity } from '../../token-lifecycle/component-ownership';

export type TokenOwnershipFindingCode =
  | 'theme-component-family-drift'
  | 'theme-semantic-namespace-drift'
  | 'theme-semantic-role-drift'
  | 'unclassified-component-family'
  | 'missing-public-component-family'
  | 'unclassified-semantic-namespace'
  | 'missing-public-semantic-namespace'
  | 'missing-current-component-token-family'
  | 'missing-component-metadata-owner'
  | 'invalid-current-component-owner'
  | 'invalid-current-component-public-state'
  | 'current-component-metadata-token-opt-out'
  | 'missing-semantic-consumer-evidence'
  | 'invalid-semantic-consumer-evidence'
  | 'missing-public-semantic-source'
  | 'unclassified-semantic-source-namespace'
  | 'nonpublic-semantic-namespace-materialized'
  | 'reserved-semantic-namespace-materialized'
  | 'invalid-current-semantic-lifecycle'
  | 'invalid-deprecated-semantic-authority'
  | 'unclassified-semantic-role';

export type TokenOwnershipFinding = {
  code: TokenOwnershipFindingCode;
  message: string;
  path: string;
};

export type TokenOwnershipReport = {
  schemaVersion: 1;
  componentFamilies: string[];
  metadataTokenFamilies: string[];
  semanticNamespaces: string[];
  semanticRolePaths: string[];
  findings: TokenOwnershipFinding[];
};

const THEMES = ['light', 'dark', 'highContrast'] as const;

function readBarrelExports(filePath: string) {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const exports = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const clause = statement.exportClause;
      if (!clause)
        throw new Error(
          `Token barrels require explicit named exports: ${filePath}`
        );
      if (ts.isNamespaceExport(clause)) exports.add(clause.name.text);
      else
        for (const element of clause.elements) {
          if (!element.isTypeOnly) exports.add(element.name.text);
        }
    } else if (
      ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      throw new Error(
        `Token barrels require explicit named exports: ${filePath}`
      );
    }
  }
  return [...exports].sort();
}

function hasSemanticConsumer(
  root: string,
  namespace: string,
  evidence: string
) {
  const component = evidence.startsWith('components.')
    ? evidence.slice('components.'.length)
    : undefined;
  const files = component
    ? THEMES.map(
        (theme) =>
          `packages/tokens/src/${theme}/components/${componentTokenExportName(component)}.ts`
      )
    : [evidence];
  return files.every((file) => {
    if (
      path.isAbsolute(file) ||
      file.split('/').includes('..') ||
      !/^(packages|apps)\//.test(file) ||
      !/\.tsx?$/.test(file) ||
      /\.(test|stories)\./.test(file)
    )
      return false;
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) return false;
    const ast = ts.createSourceFile(
      fullPath,
      fs.readFileSync(fullPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const bindings = new Set<string>();
    for (const statement of ast.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !statement.moduleSpecifier.text.endsWith(`/semantic/${namespace}.js`)
      )
        continue;
      const imports = statement.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports)) {
        for (const entry of imports.elements) {
          if ((entry.propertyName ?? entry.name).text === namespace)
            bindings.add(entry.name.text);
        }
      }
    }
    let consumed = false;
    function visit(node: ts.Node) {
      if (
        ts.isImportDeclaration(node) ||
        ts.isExportDeclaration(node) ||
        ts.isTypeNode(node)
      )
        return;
      if (ts.isPropertyAccessExpression(node)) {
        if (
          (ts.isIdentifier(node.expression) &&
            bindings.has(node.expression.text)) ||
          (node.name.text === namespace &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === 'semantic')
        )
          consumed = true;
      }
      if (
        ts.isShorthandPropertyAssignment(node) &&
        bindings.has(node.name.text)
      )
        consumed = true;
      ts.forEachChild(node, visit);
    }
    visit(ast);
    return consumed;
  });
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function componentTokenExportName(componentName: string) {
  return `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
}

function pushInventoryFindings(params: {
  actual: readonly string[];
  expectedPublic: ReadonlySet<string>;
  unclassifiedCode:
    'unclassified-component-family' | 'unclassified-semantic-namespace';
  missingCode:
    'missing-public-component-family' | 'missing-public-semantic-namespace';
  path: string;
  findings: TokenOwnershipFinding[];
}) {
  const actualSet = new Set(params.actual);

  for (const name of params.actual) {
    if (!params.expectedPublic.has(name)) {
      params.findings.push({
        code: params.unclassifiedCode,
        message: `Public token namespace "${name}" has no public lifecycle entry.`,
        path: params.path,
      });
    }
  }

  for (const name of [...params.expectedPublic].sort()) {
    if (!actualSet.has(name)) {
      params.findings.push({
        code: params.missingCode,
        message: `Lifecycle marks "${name}" public, but the token barrel does not export it.`,
        path: params.path,
      });
    }
  }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function objectPropertyName(property: ts.PropertyName): string | null {
  if (ts.isIdentifier(property) || ts.isStringLiteral(property)) {
    return property.text;
  }
  return null;
}

function canonicalShadowFactoryBinding(ast: ts.SourceFile): string | null {
  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '../../effects/shadow-system.js'
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      if (
        (element.propertyName ?? element.name).text ===
        'createSemanticShadowTokens'
      ) {
        return element.name.text;
      }
    }
  }

  return null;
}

function canonicalDerivedSemanticRolePaths(params: {
  ast: ts.SourceFile;
  expression: ts.Expression;
  namespace: string;
  theme: (typeof THEMES)[number];
}): string[] | null {
  if (params.namespace !== 'shadow') return null;

  const binding = canonicalShadowFactoryBinding(params.ast);
  const expectedTheme =
    params.theme === 'highContrast' ? 'high-contrast' : params.theme;

  if (
    !binding ||
    !ts.isCallExpression(params.expression) ||
    !ts.isIdentifier(params.expression.expression) ||
    params.expression.expression.text !== binding ||
    params.expression.arguments.length !== 1 ||
    !ts.isStringLiteral(params.expression.arguments[0]!) ||
    params.expression.arguments[0]!.text !== expectedTheme
  ) {
    throw new Error(
      `Semantic shadow source must call canonical createSemanticShadowTokens(${JSON.stringify(expectedTheme)}).`
    );
  }

  return Object.keys(createSemanticShadowTokens(expectedTheme))
    .map((role) => `shadow.${role}`)
    .sort();
}

function readSemanticRolePaths(
  filePath: string,
  namespace: string,
  theme: (typeof THEMES)[number]
): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const ast = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === namespace
    );
  const initializer = declarations[0]?.initializer;

  if (declarations.length !== 1 || !initializer) {
    throw new Error(
      `Semantic namespace source must declare exactly one ${namespace}: ${filePath}`
    );
  }

  const root = unwrapExpression(initializer);
  if (!ts.isObjectLiteralExpression(root)) {
    const derivedRoles = canonicalDerivedSemanticRolePaths({
      ast,
      expression: root,
      namespace,
      theme,
    });
    if (derivedRoles) return derivedRoles;

    throw new Error(
      `Semantic namespace source must use a static object literal or a canonical derived semantic authority: ${filePath}`
    );
  }

  const roles: string[] = [];

  function visitObject(object: ts.ObjectLiteralExpression, segments: string[]) {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(
          `Semantic namespace source must use named property assignments: ${filePath}`
        );
      }

      const name = objectPropertyName(property.name);
      if (!name) {
        throw new Error(
          `Semantic namespace source has an unsupported property name: ${filePath}`
        );
      }

      const nextSegments = [...segments, name];
      const value = unwrapExpression(property.initializer);

      if (ts.isObjectLiteralExpression(value)) {
        visitObject(value, nextSegments);
      } else {
        roles.push(`${namespace}.${nextSegments.join('.')}`);
      }
    }
  }

  visitObject(root, []);
  return roles.sort();
}

function semanticSourceNamespaces(root: string, theme: string): string[] {
  const directory = path.join(
    root,
    'packages',
    'tokens',
    'src',
    theme,
    'semantic'
  );

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        entry.name !== 'index.ts'
    )
    .map((entry) => entry.name.slice(0, -'.ts'.length))
    .sort();
}

function semanticRoleIsClassified(
  namespace: string,
  relativeRole: string,
  lifecycleStatus: 'current' | 'reserved' | 'deprecated'
): boolean {
  const exactRoles = canonicalSemanticRolePaths
    .filter((rolePath) => rolePath.startsWith(`${namespace}.`))
    .map((rolePath) => rolePath.slice(namespace.length + 1));

  if (exactRoles.length > 0) {
    return exactRoles.includes(
      relativeRole as (typeof canonicalSemanticRolePaths)[number]
    );
  }

  if (!Object.hasOwn(semanticVocabularyV1, namespace)) {
    return lifecycleStatus === 'deprecated';
  }

  const descriptor = semanticVocabularyV1[
    namespace as keyof typeof semanticVocabularyV1
  ] as {
    readonly roles: readonly string[];
    readonly intents?: readonly string[];
    readonly states?: readonly string[];
  };
  let rolePath = relativeRole;

  if (descriptor.intents) {
    const [intent, ...segments] = rolePath.split('.');
    if (!intent || !descriptor.intents.includes(intent)) return false;
    rolePath = segments.join('.');
  }

  const matchingRole = [...descriptor.roles]
    .sort((left, right) => right.length - left.length)
    .find((role) => rolePath === role || rolePath.startsWith(`${role}.`));

  if (!matchingRole) return false;

  if (descriptor.states) {
    const remainder = rolePath.slice(matchingRole.length).replace(/^\./, '');
    const [state] = remainder.split('.');
    if (state && !descriptor.states.includes(state)) return false;
  }

  return true;
}

function auditSemanticRoleLifecycle(params: {
  root: string;
  lifecycle: ReturnType<typeof readTokenLifecycleAuthority>['semantics'];
  findings: TokenOwnershipFinding[];
}): Map<string, string[]> {
  const rolesByTheme = new Map<string, string[]>();

  for (const [namespace, lifecycle] of Object.entries(params.lifecycle)) {
    if (
      lifecycle.status === 'current' &&
      (!lifecycle.public || lifecycle.authority === 'compatibility')
    ) {
      params.findings.push({
        code: 'invalid-current-semantic-lifecycle',
        message: `Current semantic namespace "${namespace}" must be public and owned by a non-compatibility authority.`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }

    if (
      lifecycle.status === 'deprecated' &&
      lifecycle.authority !== 'compatibility'
    ) {
      params.findings.push({
        code: 'invalid-deprecated-semantic-authority',
        message: `Deprecated semantic namespace "${namespace}" must be classified as compatibility authority.`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }
  }

  for (const theme of THEMES) {
    const actualNamespaces = semanticSourceNamespaces(params.root, theme);
    const actualNamespaceSet = new Set(actualNamespaces);
    const rolePaths: string[] = [];

    for (const [namespace, lifecycle] of Object.entries(params.lifecycle)) {
      if (lifecycle.public && !actualNamespaceSet.has(namespace)) {
        params.findings.push({
          code: 'missing-public-semantic-source',
          message: `Public semantic namespace "${namespace}" has no source object in ${theme}.`,
          path: `packages/tokens/src/${theme}/semantic/${namespace}.ts`,
        });
      }
    }

    for (const namespace of actualNamespaces) {
      const lifecycle = params.lifecycle[namespace];
      const sourcePath = `packages/tokens/src/${theme}/semantic/${namespace}.ts`;

      if (!lifecycle) {
        params.findings.push({
          code: 'unclassified-semantic-source-namespace',
          message: `Semantic source namespace "${namespace}" has no lifecycle authority.`,
          path: sourcePath,
        });
        continue;
      }

      if (!lifecycle.public) {
        params.findings.push({
          code: 'nonpublic-semantic-namespace-materialized',
          message: `Non-public semantic namespace "${namespace}" is still materialized in ${theme}.`,
          path: sourcePath,
        });
      }

      if (lifecycle.status === 'reserved') {
        params.findings.push({
          code: 'reserved-semantic-namespace-materialized',
          message: `Reserved semantic namespace "${namespace}" must not be materialized before promotion.`,
          path: sourcePath,
        });
      }

      const namespaceRoles = readSemanticRolePaths(
        path.join(params.root, sourcePath),
        namespace,
        theme
      );
      rolePaths.push(...namespaceRoles);

      for (const rolePath of namespaceRoles) {
        const relativeRole = rolePath.slice(namespace.length + 1);
        if (
          !semanticRoleIsClassified(namespace, relativeRole, lifecycle.status)
        ) {
          params.findings.push({
            code: 'unclassified-semantic-role',
            message: `Semantic role "${rolePath}" is not classified by canonical role vocabulary for lifecycle namespace "${namespace}".`,
            path: sourcePath,
          });
        }
      }
    }

    rolesByTheme.set(theme, rolePaths.sort());
  }

  const lightRoles = rolesByTheme.get('light') ?? [];
  for (const theme of THEMES.slice(1)) {
    const themeRoles = rolesByTheme.get(theme) ?? [];
    if (!sameValues(lightRoles, themeRoles)) {
      params.findings.push({
        code: 'theme-semantic-role-drift',
        message: `${theme} semantic role paths differ from light.`,
        path: `packages/tokens/src/${theme}/semantic`,
      });
    }
  }

  return rolesByTheme;
}

export function checkTokenOwnership(root: string): TokenOwnershipReport {
  const {
    components: componentTokenLifecycle,
    semantics: semanticTokenLifecycle,
  } = readTokenLifecycleAuthority(root);
  const findings: TokenOwnershipFinding[] = [];
  const componentInventories = new Map<string, string[]>();
  const semanticInventories = new Map<string, string[]>();

  for (const theme of THEMES) {
    const componentBarrel = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      'index.ts'
    );
    const semanticBarrel = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'semantic',
      'index.ts'
    );

    componentInventories.set(theme, readBarrelExports(componentBarrel));
    semanticInventories.set(theme, readBarrelExports(semanticBarrel));
  }

  const componentFamilies = componentInventories.get('light') ?? [];
  const semanticNamespaces = semanticInventories.get('light') ?? [];

  for (const theme of THEMES.slice(1)) {
    const componentInventory = componentInventories.get(theme) ?? [];
    const semanticInventory = semanticInventories.get(theme) ?? [];

    if (!sameValues(componentFamilies, componentInventory)) {
      findings.push({
        code: 'theme-component-family-drift',
        message: `${theme} component-token families differ from light.`,
        path: `packages/tokens/src/${theme}/components/index.ts`,
      });
    }

    if (!sameValues(semanticNamespaces, semanticInventory)) {
      findings.push({
        code: 'theme-semantic-namespace-drift',
        message: `${theme} semantic namespaces differ from light.`,
        path: `packages/tokens/src/${theme}/semantic/index.ts`,
      });
    }
  }

  const publicComponentFamilies = new Set(
    Object.entries(componentTokenLifecycle)
      .filter(([, entry]) => entry.public)
      .map(([name]) => componentTokenExportName(name))
  );
  const publicSemanticNamespaces = new Set(
    Object.entries(semanticTokenLifecycle)
      .filter(([, entry]) => entry.public)
      .map(([name]) => name)
  );

  for (const theme of THEMES) {
    pushInventoryFindings({
      actual: componentInventories.get(theme) ?? [],
      expectedPublic: publicComponentFamilies,
      unclassifiedCode: 'unclassified-component-family',
      missingCode: 'missing-public-component-family',
      path: `packages/tokens/src/${theme}/components/index.ts`,
      findings,
    });
    pushInventoryFindings({
      actual: semanticInventories.get(theme) ?? [],
      expectedPublic: publicSemanticNamespaces,
      unclassifiedCode: 'unclassified-semantic-namespace',
      missingCode: 'missing-public-semantic-namespace',
      path: `packages/tokens/src/${theme}/semantic/index.ts`,
      findings,
    });
  }

  const ownershipParity = auditComponentTokenOwnershipParity({
    metadata: componentMetadata,
    lifecycle: componentTokenLifecycle,
  });
  for (const finding of ownershipParity.findings) {
    findings.push({
      code: finding.code,
      message: finding.message,
      path: 'packages/metadata/src/tokenLifecycle.ts',
    });
  }

  for (const [namespace, lifecycle] of Object.entries(semanticTokenLifecycle)) {
    if (
      lifecycle.status === 'current' &&
      lifecycle.consumerEvidence.length === 0
    ) {
      findings.push({
        code: 'missing-semantic-consumer-evidence',
        message: `Current semantic namespace "${namespace}" has no declared consumer evidence.`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }
    for (const evidence of lifecycle.consumerEvidence) {
      if (!hasSemanticConsumer(root, namespace, evidence)) {
        findings.push({
          code: 'invalid-semantic-consumer-evidence',
          message: `Semantic namespace "${namespace}" has no consuming reference at "${evidence}".`,
          path: 'packages/metadata/src/tokenLifecycle.ts',
        });
      }
    }
  }

  const semanticRolesByTheme = auditSemanticRoleLifecycle({
    root,
    lifecycle: semanticTokenLifecycle,
    findings,
  });

  return {
    schemaVersion: 1,
    componentFamilies,
    metadataTokenFamilies: ownershipParity.metadataTokenFamilies,
    semanticNamespaces,
    semanticRolePaths: semanticRolesByTheme.get('light') ?? [],
    findings,
  };
}
