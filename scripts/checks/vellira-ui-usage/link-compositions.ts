import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { inventoryLinks, type LinkInventoryEntry } from './link-inventory';

export type CompositionDecision =
  | 'confirmed-canonical'
  | 'confirmed-composition'
  | 'needs-review';

export interface CompositionEvidence extends LinkInventoryEntry {
  reviewStatus: CompositionDecision;
  reason: string;
  memberCount: number;
}

function asChildEnabled(node: ts.JsxOpeningElement): boolean {
  const attribute = node.attributes.properties.find(
    (item) =>
      ts.isJsxAttribute(item) &&
      ts.isIdentifier(item.name) &&
      item.name.text === 'asChild'
  );
  if (!attribute || !ts.isJsxAttribute(attribute)) return false;
  if (!attribute.initializer) return true;
  return (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword
  );
}

function navigableChild(node: ts.JsxElement, nextNames: ReadonlySet<string>): boolean {
  const children = node.children.filter(
    (child) => !ts.isJsxText(child) || child.getText().trim().length > 0
  );
  if (children.length !== 1) return false;
  const child = children[0];
  if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) return false;
  const opening = ts.isJsxElement(child) ? child.openingElement : child;
  const tag = opening.tagName.getText();
  if (tag !== 'a' && !nextNames.has(tag)) return false;
  return opening.attributes.properties.some(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      ts.isIdentifier(attribute.name) &&
      attribute.name.text === 'href' &&
      attribute.initializer !== undefined
  );
}

export function classifyWebsiteSource(
  source: string,
  filename: string
): CompositionEvidence[] {
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
  );
  const nextNames = new Set<string>();
  const buttonNames = new Set<string>();
  const authNames = new Set<string>();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    if (moduleName === 'next/link' && statement.importClause?.name) {
      nextNames.add(statement.importClause.name.text);
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        const original = item.propertyName?.text ?? item.name.text;
        if (moduleName === 'next/link' && original === 'default') nextNames.add(item.name.text);
        if (moduleName === '@vellira-ui/react' && original === 'Button') buttonNames.add(item.name.text);
        if (moduleName.endsWith('/AuthTextLink') && original === 'AuthTextLink') authNames.add(item.name.text);
      }
    }
  }

  const preliminary = inventoryLinks(source, filename);
  const consumed = new Set<number>();
  const compositions: CompositionEvidence[] = [];
  const byLocation = new Map(
    preliminary.map((entry, index) => [entry.line + ':' + entry.column, index])
  );

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) && buttonNames.has(node.openingElement.tagName.getText(ast))) {
      const opening = node.openingElement;
      const pos = ast.getLineAndCharacterOfPosition(opening.getStart(ast));
      const key = pos.line + 1 + ':' + (pos.character + 1);
      const index = byLocation.get(key);
      if (index !== undefined && preliminary[index].kind === 'canonical-button') {
        const valid = asChildEnabled(opening) && navigableChild(node, nextNames);
        const child = node.children.find(
          (item) => ts.isJsxElement(item) || ts.isJsxSelfClosingElement(item)
        );
        if (valid && child) {
          const childOpening = ts.isJsxElement(child) ? child.openingElement : child as ts.JsxSelfClosingElement;
          const childPos = ast.getLineAndCharacterOfPosition(childOpening.getStart(ast));
          const childIndex = byLocation.get(childPos.line + 1 + ':' + (childPos.character + 1));
          if (childIndex !== undefined) {
            consumed.add(childIndex);
            consumed.add(index);
            compositions.push({
              ...preliminary[index],
              reviewStatus: 'confirmed-composition',
              reason: 'Imported Vellira Button with literal asChild and one navigable href child',
              memberCount: 2,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const standalone: CompositionEvidence[] = preliminary
    .filter((_, index) => !consumed.has(index))
    .map((entry) => {
      if (entry.kind === 'canonical-link') {
        return { ...entry, reviewStatus: 'confirmed-canonical', reason: 'Canonical link import', memberCount: 1 };
      }
      if (entry.kind === 'unresolved' && authNames.has(entry.tag)) {
        return { ...entry, reviewStatus: 'confirmed-canonical', reason: 'Reviewed AuthTextLink wrapper of DesignSystemLink', memberCount: 1 };
      }
      return { ...entry, reviewStatus: 'needs-review', reason: 'Unverified source composition or link semantics', memberCount: 1 };
    });
  return [...standalone, ...compositions].sort(
    (a, b) => a.line - b.line || a.column - b.column
  );
}

export function compositionReport(root = process.cwd()) {
  const directory = path.join(root, 'apps/website/src');
  const entries: CompositionEvidence[] = [];
  function walk(folder: string): void {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (item.name.startsWith('.') || ['node_modules', 'dist', 'coverage'].includes(item.name)) continue;
      const absolute = path.join(folder, item.name);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile() && /\.(tsx|jsx)$/.test(item.name)) {
        entries.push(...classifyWebsiteSource(
          fs.readFileSync(absolute, 'utf8'),
          path.relative(root, absolute).split(path.sep).join('/')
        ));
      }
    }
  }
  walk(directory);
  entries.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column);
  const needsReview = entries.filter((entry) => entry.reviewStatus === 'needs-review').length;
  return {
    schemaVersion: 2,
    policy: 'evidence-only',
    total: entries.length,
    sourceNodes: entries.reduce((sum, entry) => sum + entry.memberCount, 0),
    confirmed: entries.length - needsReview,
    needsReview,
    complete: needsReview === 0,
    entries,
  };
}

if (process.argv[1]?.endsWith('link-compositions.ts')) {
  process.stdout.write(JSON.stringify(compositionReport(), null, 2) + '\n');
}
