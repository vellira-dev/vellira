import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { ComponentGenerationTarget } from './plan';

const runtimeExportExpectationPattern =
  /expect\(Object\.keys\(api\)\.sort\(\)\)\.toEqual\(\[\n([\s\S]*?)\n {4}\]\);/;

function readRuntimeExportExpectation(publicApiTestFile: string) {
  if (!fs.existsSync(publicApiTestFile)) {
    throw new Error(`Missing public API contract test: ${publicApiTestFile}`);
  }

  const content = fs.readFileSync(publicApiTestFile, 'utf8');
  const match = runtimeExportExpectationPattern.exec(content);

  if (!match) {
    throw new Error(
      `Unable to locate runtime export expectation in ${publicApiTestFile}`
    );
  }

  const entries = [...match[1].matchAll(/ {6}'([^']+)',/g)].map(
    (entry) => entry[1]
  );

  if (entries.length === 0) {
    throw new Error(
      `Runtime export expectation is empty or invalid in ${publicApiTestFile}`
    );
  }

  return { content, entries };
}

function hasExportModifier(statement: ts.Node) {
  return Boolean(
    ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function collectBindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];

  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? collectBindingNames(element.name) : []
  );
}

function collectExplicitPublicSymbols(publicApiTestFile: string) {
  const packageRootFile = path.join(
    path.dirname(publicApiTestFile),
    'index.ts'
  );

  if (!fs.existsSync(packageRootFile)) {
    throw new Error(`Missing public API package root: ${packageRootFile}`);
  }

  const sourceFile = ts.createSourceFile(
    packageRootFile,
    fs.readFileSync(packageRootFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const symbols = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier && !statement.exportClause) {
        throw new Error(
          `Public API package root must use explicit named exports: ${packageRootFile}`
        );
      }

      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          symbols.add(element.name.text);
        }
      }

      continue;
    }

    if (!hasExportModifier(statement)) continue;

    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      symbols.add(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of collectBindingNames(declaration.name)) {
          symbols.add(name);
        }
      }
    }
  }

  return [...symbols].sort();
}

type PublicSymbolContract = {
  start: number;
  end: number;
};

function readPublicSymbolContract(
  content: string,
  publicApiTestFile: string
): PublicSymbolContract | null {
  const sourceFile = ts.createSourceFile(
    publicApiTestFile,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== 'publicApiSymbols' ||
        !declaration.initializer
      ) {
        continue;
      }

      let initializer: ts.Expression = declaration.initializer;

      while (
        ts.isAsExpression(initializer) ||
        ts.isSatisfiesExpression(initializer)
      ) {
        initializer = initializer.expression;
      }

      if (!ts.isArrayLiteralExpression(initializer)) {
        throw new Error(
          `publicApiSymbols must be an array literal in ${publicApiTestFile}`
        );
      }

      const entries = initializer.elements.map((element) => {
        if (!ts.isStringLiteral(element)) {
          throw new Error(
            `publicApiSymbols must contain only string literals in ${publicApiTestFile}`
          );
        }

        return element.text;
      });

      if (new Set(entries).size !== entries.length) {
        throw new Error(
          `Duplicate publicApiSymbols entry in ${publicApiTestFile}`
        );
      }

      return {
        start: statement.getStart(sourceFile),
        end: statement.end,
      };
    }
  }

  return null;
}

function renderPublicSymbolContract(entries: readonly string[]) {
  return `export const publicApiSymbols = [\n${[...entries]
    .sort()
    .map((entry) => `  '${entry}',`)
    .join('\n')}\n] as const;`;
}

function synchronizePublicSymbolContract(params: {
  content: string;
  publicApiTestFile: string;
  entries: readonly string[];
}) {
  const { content, publicApiTestFile, entries } = params;
  const contract = readPublicSymbolContract(content, publicApiTestFile);
  const rendered = renderPublicSymbolContract(entries);

  if (contract) {
    return (
      content.slice(0, contract.start) +
      rendered +
      content.slice(contract.end)
    );
  }

  const sourceFile = ts.createSourceFile(
    publicApiTestFile,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const insertAt = imports.at(-1)?.end ?? 0;
  const prefix = content.slice(0, insertAt);
  const suffix = content.slice(insertAt);

  return `${prefix}${prefix ? '\n\n' : ''}${rendered}${suffix}`;
}

export function renderSynchronizedPublicApiContract(params: {
  componentName: string;
  publicApiTestFile: string;
}) {
  const { componentName, publicApiTestFile } = params;
  const { content, entries } = readRuntimeExportExpectation(publicApiTestFile);
  const nextEntries = entries.includes(componentName)
    ? [...entries]
    : [...entries, componentName].sort();
  const nextExpectation = `expect(Object.keys(api).sort()).toEqual([\n${nextEntries
    .map((entry) => `      '${entry}',`)
    .join('\n')}\n    ]);`;
  const runtimeSynchronizedContent = content.replace(
    runtimeExportExpectationPattern,
    nextExpectation
  );

  return synchronizePublicSymbolContract({
    content: runtimeSynchronizedContent,
    publicApiTestFile,
    entries: collectExplicitPublicSymbols(publicApiTestFile),
  });
}

export function checkPublicApiContractSynchronization(params: {
  componentName: string;
  targets: readonly ComponentGenerationTarget[];
}) {
  const driftedFiles: string[] = [];

  for (const target of params.targets) {
    const current = fs.existsSync(target.publicApiTestFile)
      ? fs.readFileSync(target.publicApiTestFile, 'utf8')
      : '';
    const expected = renderSynchronizedPublicApiContract({
      componentName: params.componentName,
      publicApiTestFile: target.publicApiTestFile,
    });

    if (current !== expected) driftedFiles.push(target.publicApiTestFile);
  }

  return driftedFiles;
}
