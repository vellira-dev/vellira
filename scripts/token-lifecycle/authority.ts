import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type {
  ComponentTokenLifecycleEntry,
  SemanticTokenLifecycleEntry,
} from '@vellira-ui/metadata';

export function getTokenLifecycleRegistryFile(root: string) {
  return path.join(root, 'packages/metadata/src/tokenLifecycle.ts');
}

function unwrap(node: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

// Read the canonical source, never a potentially stale dist module. Only static
// literals are accepted; evaluating registry code would hide unsupported drift.
function literal(node: ts.Expression): unknown {
  node = unwrap(node);
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = Object.create(null);
    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ) {
        throw new Error(
          'Token lifecycle authority must contain only named literal properties.'
        );
      }
      const name = property.name.text;
      if (Object.hasOwn(result, name))
        throw new Error(`Duplicate token lifecycle property: ${name}`);
      result[name] = literal(property.initializer);
    }
    return result;
  }
  throw new Error(
    'Token lifecycle authority must contain only static literals.'
  );
}

export function readTokenLifecycleAuthority(root: string) {
  const file = getTokenLifecycleRegistryFile(root);
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function registry(name: string) {
    const declarations = ast.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .filter(
        (declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name
      );
    const initializer = declarations[0]?.initializer;
    if (declarations.length !== 1 || !initializer)
      throw new Error(`Missing or duplicate lifecycle authority: ${name}`);
    const object = unwrap(initializer);
    if (!ts.isObjectLiteralExpression(object))
      throw new Error(`Invalid lifecycle authority: ${name}`);
    const entries = literal(object) as Record<
      string,
      ComponentTokenLifecycleEntry | SemanticTokenLifecycleEntry
    >;
    for (const [key, entry] of Object.entries(entries)) {
      if (
        !entry ||
        !['current', 'reserved', 'deprecated'].includes(entry.status) ||
        typeof entry.public !== 'boolean' ||
        typeof entry.owner !== 'string' ||
        !entry.owner.trim() ||
        typeof entry.purpose !== 'string' ||
        !entry.purpose.trim()
      ) {
        throw new Error(`Invalid token lifecycle entry: ${name}.${key}`);
      }
      if (name === 'semanticTokenLifecycle') {
        const semantic = entry as SemanticTokenLifecycleEntry;
        if (
          !['component-input', 'shared-lower-level', 'compatibility'].includes(
            semantic.authority
          ) ||
          !Array.isArray(semantic.consumerEvidence) ||
          !semantic.consumerEvidence.every(
            (evidence) => typeof evidence === 'string' && evidence.trim()
          )
        ) {
          throw new Error(`Invalid semantic lifecycle entry: ${key}`);
        }
      }
    }
    return { object, entries };
  }
  const components = registry('componentTokenLifecycle');
  const semantics = registry('semanticTokenLifecycle');
  return {
    file,
    source,
    ast,
    componentObject: components.object,
    semanticObject: semantics.object,
    components: components.entries as Record<
      string,
      ComponentTokenLifecycleEntry
    >,
    semantics: semantics.entries as Record<string, SemanticTokenLifecycleEntry>,
  };
}

export function promoteReservedTokenFamily(
  root: string,
  componentName: string
) {
  const authority = readTokenLifecycleAuthority(root);
  const entry = authority.componentObject.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === componentName
  );
  if (
    !entry ||
    !ts.isPropertyAssignment(entry) ||
    !ts.isObjectLiteralExpression(entry.initializer)
  ) {
    throw new Error(`Missing reserved token lifecycle entry: ${componentName}`);
  }
  const status = entry.initializer.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === 'status'
  );
  if (
    !status ||
    !ts.isPropertyAssignment(status) ||
    literal(status.initializer) !== 'reserved'
  ) {
    throw new Error(`Invalid reserved token lifecycle entry: ${componentName}`);
  }
  const source =
    authority.source.slice(0, status.initializer.getStart(authority.ast)) +
    "'current'" +
    authority.source.slice(status.initializer.end);
  fs.writeFileSync(authority.file, source);
  return authority.file;
}
