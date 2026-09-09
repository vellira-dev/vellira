import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { componentMetadata } from '../../../packages/metadata/src/components';
import { readTokenLifecycleAuthority } from '../../token-lifecycle/authority';

export type TokenOwnershipFindingCode =
  | 'theme-component-family-drift'
  | 'theme-semantic-namespace-drift'
  | 'unclassified-component-family'
  | 'missing-public-component-family'
  | 'unclassified-semantic-namespace'
  | 'missing-public-semantic-namespace'
  | 'missing-component-metadata-owner'
  | 'invalid-current-component-owner'
  | 'missing-semantic-consumer-evidence'
  | 'invalid-semantic-consumer-evidence'
  | 'invalid-current-component-public-state';

export type TokenOwnershipFinding = {
  code: TokenOwnershipFindingCode;
  message: string;
  path: string;
};

export type TokenOwnershipReport = {
  schemaVersion: 1;
  componentFamilies: string[];
  semanticNamespaces: string[];
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

  const metadataNames = new Set(componentMetadata.map((entry) => entry.name));

  for (const [family, lifecycle] of Object.entries(componentTokenLifecycle)) {
    if (lifecycle.status !== 'current') continue;

    if (!lifecycle.public) {
      findings.push({
        code: 'invalid-current-component-public-state',
        message: `Current component-token family "${family}" must be public.`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }

    if (lifecycle.owner !== family) {
      findings.push({
        code: 'invalid-current-component-owner',
        message: `Current component-token family "${family}" must be owned by canonical component metadata of the same name, not "${lifecycle.owner}".`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
      continue;
    }

    if (!metadataNames.has(lifecycle.owner)) {
      findings.push({
        code: 'missing-component-metadata-owner',
        message: `Current component-token family "${family}" references missing component metadata owner "${lifecycle.owner}".`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }
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

  return {
    schemaVersion: 1,
    componentFamilies,
    semanticNamespaces,
    findings,
  };
}
