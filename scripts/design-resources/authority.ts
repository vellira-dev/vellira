import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

export type DesignResourcePlatform = 'react' | 'react-native';

const CANONICAL_ASSET_ROOTS = new Set(['brand', 'fonts', 'styles']);

export function canonicalAssetRoot(root: string) {
  return path.join(root, 'packages', 'assets');
}

export function canonicalAssetPath(params: {
  root: string;
  assetPath: string;
}): string | null {
  const portable = params.assetPath.replace(/\\/g, '/');
  const segments = portable.split('/');

  if (
    portable.length === 0 ||
    path.posix.isAbsolute(portable) ||
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..'
    ) ||
    !CANONICAL_ASSET_ROOTS.has(segments[0] ?? '')
  ) {
    return null;
  }

  return path.join(canonicalAssetRoot(params.root), ...segments);
}

export function canonicalAssetExists(params: {
  root: string;
  assetPath: string;
}) {
  const filePath = canonicalAssetPath(params);

  return (
    filePath !== null &&
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isFile()
  );
}

export function canonicalIconSourcePath(params: {
  root: string;
  platform: DesignResourcePlatform;
}) {
  return path.join(
    params.root,
    'packages',
    'icons',
    'src',
    params.platform === 'react' ? 'web.source.ts' : 'native.source.ts'
  );
}

export function canonicalIconExports(params: {
  root: string;
  platform: DesignResourcePlatform;
}): Set<string> | null {
  const filePath = canonicalIconSourcePath(params);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');

  return new Set(
    [
      ...source.matchAll(/export\s*{\s*default\s+as\s+([A-Za-z_$][\w$]*)\s*}/g),
    ].map((match) => match[1])
  );
}

export function canonicalTokenRegistryPath(root: string) {
  return path.join(
    root,
    'packages',
    'tokens',
    'src',
    'generated',
    'token-types.ts'
  );
}

export function canonicalTokenPaths(root: string): Set<string> | null {
  return readCanonicalStringArray(
    canonicalTokenRegistryPath(root),
    'tokenPaths'
  );
}

export function canonicalCssVariableNames(root: string): Set<string> | null {
  return readCanonicalStringArray(
    canonicalTokenRegistryPath(root),
    'cssVariableNames'
  );
}

function readCanonicalStringArray(
  filePath: string,
  variableName: string
): Set<string> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  let result: Set<string> | null = null;

  function unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression;

    while (
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }

    return current;
  }

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);

      if (!ts.isArrayLiteralExpression(initializer)) {
        result = null;
        return;
      }

      const values: string[] = [];

      for (const element of initializer.elements) {
        if (
          !ts.isStringLiteral(element) &&
          !ts.isNoSubstitutionTemplateLiteral(element)
        ) {
          result = null;
          return;
        }

        values.push(element.text);
      }

      result = new Set(values);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return result;
}
