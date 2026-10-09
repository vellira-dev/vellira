import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  parseRuntimeExportExpectation,
  runtimeExportExpectationPattern,
} from '../../public-api/runtime-export-authority.mjs';

import { getGeneratedPublicPropTypeNames } from './public-api';

import type {
  ComponentGenerationPlan,
  ComponentGenerationTarget,
} from './plan';

export function assertRegularRepositoryFile(root: string, file: string) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative) ||
    !relative ||
    relative === '..'
  )
    throw new Error('Public symbol authority is outside the repository.');
  if (
    !fs.lstatSync(file).isFile() ||
    fs.realpathSync(file) !== path.join(fs.realpathSync(root), relative)
  )
    throw new Error(
      'Public symbol authority must be a regular file without symlink traversal.'
    );
}

function readRuntimeExportExpectation(publicApiTestFile: string) {
  if (!fs.existsSync(publicApiTestFile)) {
    throw new Error(`Missing public API contract test: ${publicApiTestFile}`);
  }

  const content = fs.readFileSync(publicApiTestFile, 'utf8');

  return {
    content,
    entries: parseRuntimeExportExpectation(content, publicApiTestFile),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPublicSymbolEntryPath(target: ComponentGenerationTarget) {
  if (target.packageName === 'react') {
    return 'packages/react/src/index.ts';
  }

  if (target.packageName === 'react-native') {
    return 'packages/react-native/src/index.ts';
  }

  throw new Error(
    `Unsupported generated public API package: ${target.packageName}`
  );
}

function renderSymbolInventory(
  content: string,
  entryPath: string,
  generatedSymbols: readonly string[]
) {
  const blockPattern = new RegExp(
    `('${escapeRegExp(entryPath)}': \\[\\n)([\\s\\S]*?)(\\n {2}\\],)`
  );
  const match = blockPattern.exec(content);
  if (!match)
    throw new Error(`Unable to locate public symbol contract for ${entryPath}`);
  const existing = [...match[2].matchAll(/ {4}'([^']+)',/g)].map(
    (entry) => entry[1]
  );
  const symbols = [...new Set([...existing, ...generatedSymbols])].sort();
  return content.replace(
    blockPattern,
    `${match[1]}${symbols.map((symbol) => `    '${symbol}',`).join('\n')}${match[3]}`
  );
}

function renderSynchronizedPublicSymbolContract(params: {
  content: string;
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
}) {
  return renderSymbolInventory(
    params.content,
    getPublicSymbolEntryPath(params.target),
    [params.plan.componentName, ...getGeneratedPublicPropTypeNames(params.plan)]
  );
}

/** The materialized shared contract owns its exported type names, including
 * approved domains/objects. Renderer prop naming is not a second inventory. */
export function renderSynchronizedSharedSymbolContract(
  content: string,
  plan: ComponentGenerationPlan
) {
  if (plan.typeOwnership !== 'shared' || !fs.existsSync(plan.sharedTypesFile))
    return content;
  assertRegularRepositoryFile(plan.root, plan.sharedTypesFile);
  const source = ts.createSourceFile(
    plan.sharedTypesFile,
    fs.readFileSync(plan.sharedTypesFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const symbols: string[] = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement))
      throw new Error(
        'Generated shared contract must expose explicit type declarations only.'
      );
    if (
      !ts.canHaveModifiers(statement) ||
      !ts
        .getModifiers(statement)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    if (
      (!ts.isInterfaceDeclaration(statement) &&
        !ts.isTypeAliasDeclaration(statement)) ||
      !statement.name
    ) {
      throw new Error(
        'Generated shared contract must expose explicit type declarations only.'
      );
    }
    const name = statement.name.text;
    if (
      !name.startsWith(plan.componentName) &&
      !name.startsWith(`Base${plan.componentName}`)
    ) {
      throw new Error(`Shared type ${name} is outside component ownership.`);
    }
    symbols.push(name);
  }
  if (symbols.length === 0)
    throw new Error('Generated shared contract has no exported types.');
  return renderSymbolInventory(content, 'packages/types/src/index.ts', symbols);
}

export function getPublicSymbolContractFile(root: string) {
  return path.join(root, 'scripts', 'check-public-api.mjs');
}

export function renderSynchronizedPublicApiContract(params: {
  componentName: string;
  publicApiTestFile: string;
}) {
  const { componentName, publicApiTestFile } = params;
  const { content, entries } = readRuntimeExportExpectation(publicApiTestFile);

  if (entries.includes(componentName)) {
    return content;
  }

  const nextEntries = [...entries, componentName].sort();
  const nextExpectation = `expect(Object.keys(api).sort()).toEqual([\n${nextEntries
    .map((entry) => `      '${entry}',`)
    .join('\n')}\n    ]);`;

  return content.replace(runtimeExportExpectationPattern, nextExpectation);
}

export function synchronizePublicSymbolContracts(params: {
  plan: ComponentGenerationPlan;
  updatedFiles: string[];
}) {
  const { plan, updatedFiles } = params;
  const contractFile = getPublicSymbolContractFile(plan.root);

  if (!fs.existsSync(contractFile)) {
    return;
  }

  assertRegularRepositoryFile(plan.root, contractFile);

  let content = fs.readFileSync(contractFile, 'utf8');

  for (const target of plan.targets) {
    content = renderSynchronizedPublicSymbolContract({
      content,
      plan,
      target,
    });
  }

  content = renderSynchronizedSharedSymbolContract(content, plan);
  const current = fs.readFileSync(contractFile, 'utf8');

  if (content === current) {
    return;
  }

  fs.writeFileSync(contractFile, content);

  if (!updatedFiles.includes(contractFile)) {
    updatedFiles.push(contractFile);
  }
}

export function checkPublicApiContractSynchronization(
  plan: ComponentGenerationPlan
) {
  const driftedFiles: string[] = [];

  for (const target of plan.targets) {
    const current = fs.existsSync(target.publicApiTestFile)
      ? fs.readFileSync(target.publicApiTestFile, 'utf8')
      : '';

    const expected = renderSynchronizedPublicApiContract({
      componentName: plan.componentName,
      publicApiTestFile: target.publicApiTestFile,
    });

    if (current !== expected) {
      driftedFiles.push(target.publicApiTestFile);
    }
  }

  const contractFile = getPublicSymbolContractFile(plan.root);

  if (fs.existsSync(contractFile)) {
    const current = fs.readFileSync(contractFile, 'utf8');
    let expected = current;

    for (const target of plan.targets) {
      expected = renderSynchronizedPublicSymbolContract({
        content: expected,
        plan,
        target,
      });
    }

    expected = renderSynchronizedSharedSymbolContract(expected, plan);
    if (current !== expected) {
      driftedFiles.push(contractFile);
    }
  }

  return driftedFiles;
}
