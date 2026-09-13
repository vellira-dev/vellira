import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { declaredCssVariables } from './css-references';

type ComponentBoundary = {
  rootPath: string;
  componentName: string;
};

function componentBoundary(sourcePath: string): ComponentBoundary | null {
  const match = sourcePath.match(
    /^packages\/react\/src\/(components|primitives|patterns)\/([^/]+)\/(.+)$/
  );
  if (!match) return null;

  const [, category, componentName] = match;
  if (!category || !componentName) return null;

  return {
    rootPath: `packages/react/src/${category}/${componentName}`,
    componentName,
  };
}

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function repositoryPath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function sourceFile(sourcePath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function styleCompanionSource(root: string, stylePath: string): string | null {
  const match = stylePath.match(/^(.*)\.module\.(?:css|scss)$/);
  if (!match?.[1]) return null;

  for (const extension of ['.tsx', '.ts']) {
    const candidate = `${match[1]}${extension}`;
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }

  return null;
}

function resolveRelativeModule(
  root: string,
  importerPath: string,
  specifier: string
): string | null {
  if (!specifier.startsWith('.')) return null;

  const importerDirectory = path.dirname(path.join(root, importerPath));
  const base = path.resolve(importerDirectory, specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    if (!/\.(?:ts|tsx)$/.test(candidate)) continue;
    return repositoryPath(root, candidate);
  }

  return null;
}

function resolveExportedSymbol(
  root: string,
  modulePath: string,
  symbolName: string,
  visited = new Set<string>()
): string | null {
  const key = `${modulePath}#${symbolName}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const absolutePath = path.join(root, modulePath);
  if (!fs.existsSync(absolutePath)) return null;

  const source = fs.readFileSync(absolutePath, 'utf8');
  const parsed = sourceFile(modulePath, source);
  let locallyExported = false;

  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement)) {
      const exported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (exported) {
        for (const declaration of statement.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === symbolName
          ) {
            locallyExported = true;
          }
        }
      }
    }

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === symbolName &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      locallyExported = true;
    }

    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier)
      continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const targetModule = resolveRelativeModule(
      root,
      modulePath,
      statement.moduleSpecifier.text
    );
    if (!targetModule) continue;

    if (!statement.exportClause) {
      const resolved = resolveExportedSymbol(
        root,
        targetModule,
        symbolName,
        visited
      );
      if (resolved) return resolved;
      continue;
    }

    if (!ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      if (element.name.text !== symbolName) continue;
      const sourceName = element.propertyName?.text ?? element.name.text;
      return (
        resolveExportedSymbol(root, targetModule, sourceName, visited) ??
        targetModule
      );
    }
  }

  if (locallyExported || path.basename(modulePath).startsWith(symbolName)) {
    return modulePath;
  }

  return path.basename(modulePath).startsWith('index.') ? null : modulePath;
}

function importedRenderedTargets(
  root: string,
  sourcePath: string,
  parsed: ts.SourceFile,
  subtree: ts.Node
): ReadonlySet<string> {
  const imports = new Map<
    string,
    { importedName: string; moduleSpecifier: string }
  >();

  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      imports.set(element.name.text, {
        importedName: element.propertyName?.text ?? element.name.text,
        moduleSpecifier: statement.moduleSpecifier.text,
      });
    }
  }

  const targets = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName)) {
        const imported = imports.get(node.tagName.text);
        if (imported) {
          const modulePath = resolveRelativeModule(
            root,
            sourcePath,
            imported.moduleSpecifier
          );
          if (modulePath) {
            const target = resolveExportedSymbol(
              root,
              modulePath,
              imported.importedName
            );
            if (target) targets.add(target);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(subtree);
  return targets;
}

function textUsesStyleClass(
  text: string,
  styleBinding: string,
  className: string
): boolean {
  return (
    text.includes(`${styleBinding}.${className}`) ||
    text.includes(`${styleBinding}['${className}']`) ||
    text.includes(`${styleBinding}["${className}"]`)
  );
}

function variableInitializerUsesStyleClass(
  parsed: ts.SourceFile,
  variableName: string,
  styleBinding: string,
  className: string
): boolean {
  let matches = false;

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      textUsesStyleClass(
        node.initializer.getText(parsed),
        styleBinding,
        className
      )
    ) {
      matches = true;
      return;
    }
    if (!matches) ts.forEachChild(node, visit);
  }

  visit(parsed);
  return matches;
}

function jsxElementUsesStyleClass(
  element: ts.JsxElement,
  styleBinding: string,
  className: string,
  parsed: ts.SourceFile
): boolean {
  const classAttribute = element.openingElement.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(parsed) === 'className'
  );
  if (!classAttribute?.initializer) return false;

  if (
    textUsesStyleClass(
      classAttribute.initializer.getText(parsed),
      styleBinding,
      className
    )
  ) {
    return true;
  }

  if (
    ts.isJsxExpression(classAttribute.initializer) &&
    classAttribute.initializer.expression &&
    ts.isIdentifier(classAttribute.initializer.expression)
  ) {
    return variableInitializerUsesStyleClass(
      parsed,
      classAttribute.initializer.expression.text,
      styleBinding,
      className
    );
  }

  return false;
}

function variableProviderClasses(
  stylePath: string,
  source: string
): ReadonlyMap<string, ReadonlySet<string>> {
  const byVariable = new Map<string, Set<string>>();
  const classPattern = /\.([A-Za-z_][\w-]*)\s*\{/g;

  for (const match of source.matchAll(classPattern)) {
    const className = match[1];
    if (!className || match.index === undefined) continue;
    const openBrace = source.indexOf('{', match.index);
    if (openBrace < 0) continue;

    let depth = 0;
    let closeBrace = -1;
    for (let index = openBrace; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          closeBrace = index;
          break;
        }
      }
    }
    if (closeBrace < 0) continue;

    const block = source.slice(openBrace + 1, closeBrace);
    for (const variable of declaredCssVariables(stylePath, block)) {
      const classes = byVariable.get(variable) ?? new Set<string>();
      classes.add(className);
      byVariable.set(variable, classes);
    }
  }

  return byVariable;
}

function styleImportBinding(
  root: string,
  sourcePath: string,
  stylePath: string,
  parsed: ts.SourceFile
): string | null {
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.name) {
      continue;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const resolved = path.resolve(
      path.dirname(path.join(root, sourcePath)),
      statement.moduleSpecifier.text
    );
    if (repositoryPath(root, resolved) === stylePath) {
      return statement.importClause.name.text;
    }
  }
  return null;
}

function providerVariablesInheritedBy(
  root: string,
  providerStylePath: string,
  consumerSourcePath: string
): ReadonlySet<string> {
  const providerSourcePath = styleCompanionSource(root, providerStylePath);
  if (!providerSourcePath) return new Set();

  const providerSource = fs.readFileSync(
    path.join(root, providerSourcePath),
    'utf8'
  );
  const parsed = sourceFile(providerSourcePath, providerSource);
  const styleBinding = styleImportBinding(
    root,
    providerSourcePath,
    providerStylePath,
    parsed
  );
  if (!styleBinding) return new Set();
  const resolvedProviderSourcePath = providerSourcePath;
  const resolvedStyleBinding = styleBinding;

  const providerStyleSource = fs.readFileSync(
    path.join(root, providerStylePath),
    'utf8'
  );
  const classesByVariable = variableProviderClasses(
    providerStylePath,
    providerStyleSource
  );
  const variables = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      for (const [variable, classes] of classesByVariable) {
        if (
          [...classes].some((className) =>
            jsxElementUsesStyleClass(
              node,
              resolvedStyleBinding,
              className,
              parsed
            )
          ) &&
          importedRenderedTargets(
            root,
            resolvedProviderSourcePath,
            parsed,
            node
          ).has(consumerSourcePath)
        ) {
          variables.add(variable);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return variables;
}

export function componentAncestorProviderVariables(
  root: string,
  sourcePath: string,
  cache: Map<string, ReadonlySet<string>>
): ReadonlySet<string> {
  const cached = cache.get(sourcePath);
  if (cached) return cached;

  const boundary = componentBoundary(sourcePath);
  const consumerSourcePath = styleCompanionSource(root, sourcePath);
  if (!boundary || !consumerSourcePath) {
    const empty = new Set<string>();
    cache.set(sourcePath, empty);
    return empty;
  }
  const resolvedConsumerSourcePath = consumerSourcePath;

  const prefix = `--${kebabCase(boundary.componentName)}-`;
  const variables = new Set<string>();
  const componentRoot = path.join(root, boundary.rootPath);

  function walkStyles(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walkStyles(absolutePath);
        continue;
      }
      if (!entry.isFile() || !/\.module\.(?:css|scss)$/.test(entry.name)) {
        continue;
      }

      const providerStylePath = repositoryPath(root, absolutePath);
      if (providerStylePath === sourcePath) continue;
      for (const variable of providerVariablesInheritedBy(
        root,
        providerStylePath,
        resolvedConsumerSourcePath
      )) {
        if (variable.startsWith(prefix)) variables.add(variable);
      }
    }
  }

  if (fs.existsSync(componentRoot)) walkStyles(componentRoot);
  cache.set(sourcePath, variables);
  return variables;
}
