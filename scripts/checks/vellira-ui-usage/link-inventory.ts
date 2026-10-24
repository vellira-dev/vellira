import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

export type LinkKind =
  | 'canonical-link'
  | 'canonical-button'
  | 'raw-anchor'
  | 'next-link'
  | 'unresolved';

export interface LinkInventoryEntry {
  path: string;
  line: number;
  column: number;
  tag: string;
  kind: LinkKind;
  owner: string | null;
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'coverage'].includes(entry.name)) return [];
    const location = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(location);
    return entry.isFile() && /\.tsx$|\.jsx$/.test(entry.name) ? [location] : [];
  }).sort();
}

export function inventoryLinks(source: string, filename: string): LinkInventoryEntry[] {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX);
  const nextLinks = new Set<string>();
  const canonicalLinks = new Set<string>();
  const buttons = new Set<string>();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    const imports = statement.importClause;
    if (moduleName === 'next/link') {
      if (imports?.name) nextLinks.add(imports.name.text);
      const bindings = imports?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) {
          if ((item.propertyName?.text ?? item.name.text) === 'default') nextLinks.add(item.name.text);
        }
      }
    }
    const bindings = imports?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        const original = item.propertyName?.text ?? item.name.text;
        if (original === 'DesignSystemLink' || original === 'BlogDesignSystemLink') canonicalLinks.add(item.name.text);
        if (moduleName === '@vellira-ui/react' && original === 'Button') buttons.add(item.name.text);
      }
    }
  }
  const entries: LinkInventoryEntry[] = [];
  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      let kind: LinkKind | null = null;
      if (tag === 'a') kind = 'raw-anchor';
      else if (nextLinks.has(tag)) kind = 'next-link';
      else if (canonicalLinks.has(tag)) kind = 'canonical-link';
      else if (buttons.has(tag) && node.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.text === 'asChild')) kind = 'canonical-button';
      else if (/Link$/.test(tag)) kind = 'unresolved';
      if (kind) {
        const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
        let parent = node.parent;
        let owner: string | null = null;
        while (parent) {
          if (ts.isJsxElement(parent)) {
            const name = parent.openingElement.tagName.getText(ast);
            if (buttons.has(name)) { owner = 'Button'; break; }
            if (name === 'nav') { owner = 'nav'; break; }
          }
          parent = parent.parent;
        }
        entries.push({ path: filename, line: position.line + 1, column: position.character + 1, tag, kind, owner });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return entries;
}

export function inventoryWebsite(root = process.cwd()): LinkInventoryEntry[] {
  const prefix = path.join(root, 'apps/website/src');
  return filesUnder(prefix).flatMap((filename) => {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    return inventoryLinks(fs.readFileSync(filename, 'utf8'), relative);
  });
}

if (process.argv[1]?.endsWith('link-inventory.ts')) {
  const entries = inventoryWebsite();
  const counts = Object.fromEntries(
    ['canonical-link', 'canonical-button', 'raw-anchor', 'next-link', 'unresolved'].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])
  );
  process.stdout.write(JSON.stringify({ schemaVersion: 1, scope: 'apps/website/src/**/*.{tsx,jsx}', total: entries.length, counts, entries }, null, 2) + '\n');
}
