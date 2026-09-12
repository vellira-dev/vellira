import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const shikiConsumerStyles = new Set([
  'apps/website/src/blog/ui/BlogCodeBlock.module.css',
  'apps/website/src/styles/globals.css',
]);

const shikiVariableSuffixes = new Set([
  '',
  '-bg',
  '-font-style',
  '-font-weight',
  '-text-decoration',
]);

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  name: string
): ts.PropertyAssignment | null {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (propertyNameText(property.name) === name) return property;
  }
  return null;
}

function configuredShikiAliases(sourcePath: string, source: string) {
  const parsed = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const highlighterImports = new Set<string>();

  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== 'shiki') continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === 'createHighlighter') {
        highlighterImports.add(element.name.text);
      }
    }
  }

  if (highlighterImports.size === 0) return null;

  const configuredThemes = new Set<string>();
  const aliases = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        highlighterImports.has(node.expression.text)
      ) {
        const options = node.arguments[0];
        if (options && ts.isObjectLiteralExpression(options)) {
          const themes = objectProperty(options, 'themes')?.initializer;
          if (themes && ts.isArrayLiteralExpression(themes)) {
            for (const element of themes.elements) {
              if (ts.isStringLiteral(element))
                configuredThemes.add(element.text);
            }
          }
        }
      }

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'codeToHtml'
      ) {
        const options = node.arguments[1];
        if (options && ts.isObjectLiteralExpression(options)) {
          const themes = objectProperty(options, 'themes')?.initializer;
          if (themes && ts.isObjectLiteralExpression(themes)) {
            for (const property of themes.properties) {
              if (!ts.isPropertyAssignment(property)) continue;
              const alias = propertyNameText(property.name);
              if (!alias || !ts.isStringLiteral(property.initializer)) continue;
              if (configuredThemes.has(property.initializer.text)) {
                aliases.add(alias);
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return configuredThemes.size > 0 && aliases.size > 0 ? aliases : null;
}

function shikiDependencyIsDeclared(root: string): boolean {
  const packagePath = path.join(root, 'apps/website/package.json');
  if (!fs.existsSync(packagePath)) return false;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    return (
      typeof packageJson.dependencies?.shiki === 'string' ||
      typeof packageJson.devDependencies?.shiki === 'string'
    );
  } catch {
    return false;
  }
}

function shikiVariableAlias(
  variable: string,
  aliases: ReadonlySet<string>
): string | null {
  for (const alias of [...aliases].sort(
    (left, right) => right.length - left.length
  )) {
    const prefix = `--shiki-${alias}`;
    if (!variable.startsWith(prefix)) continue;
    const suffix = variable.slice(prefix.length);
    if (shikiVariableSuffixes.has(suffix)) return alias;
  }
  return null;
}

export function shikiProviderVariables(
  root: string,
  sourcePath: string,
  source: string,
  cache: Map<string, ReadonlySet<string>>
): ReadonlySet<string> {
  if (!shikiConsumerStyles.has(sourcePath) || !source.includes('.shiki')) {
    return new Set();
  }

  const cacheKey = 'apps/website:shiki-provider';
  let aliases = cache.get(cacheKey);
  if (!aliases) {
    const ownerPath = 'apps/website/src/blog/ui/BlogCodeBlock.tsx';
    const absoluteOwnerPath = path.join(root, ownerPath);
    const discovered = new Set<string>();

    if (shikiDependencyIsDeclared(root) && fs.existsSync(absoluteOwnerPath)) {
      const configuredAliases = configuredShikiAliases(
        ownerPath,
        fs.readFileSync(absoluteOwnerPath, 'utf8')
      );
      if (configuredAliases) {
        for (const alias of configuredAliases) discovered.add(alias);
      }
    }

    aliases = discovered;
    cache.set(cacheKey, aliases);
  }

  if (aliases.size === 0) return new Set();

  const variables = new Set<string>();
  for (const match of source.matchAll(/var\(\s*(--shiki-[A-Za-z0-9_-]+)/g)) {
    const variable = match[1];
    if (variable && shikiVariableAlias(variable, aliases))
      variables.add(variable);
  }
  return variables;
}
