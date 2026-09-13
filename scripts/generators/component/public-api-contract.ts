import fs from 'node:fs';
import path from 'node:path';

import { getGeneratedPublicPropTypeNames } from './public-api';

import type {
  ComponentGenerationPlan,
  ComponentGenerationTarget,
} from './plan';

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

  return {
    content,
    entries,
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

function renderSynchronizedPublicSymbolContract(params: {
  content: string;
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
}) {
  const { content, plan, target } = params;
  const entryPath = getPublicSymbolEntryPath(target);
  const blockPattern = new RegExp(
    `('${escapeRegExp(entryPath)}': \\[\\n)([\\s\\S]*?)(\\n {2}\\],)`
  );
  const match = blockPattern.exec(content);

  if (!match) {
    throw new Error(
      `Unable to locate public symbol contract for ${entryPath}`
    );
  }

  const existingSymbols = [...match[2].matchAll(/ {4}'([^']+)',/g)].map(
    (entry) => entry[1]
  );
  const generatedSymbols = [
    plan.componentName,
    ...getGeneratedPublicPropTypeNames(plan),
  ];
  const nextSymbols = [...new Set([...existingSymbols, ...generatedSymbols])].sort();
  const nextBlock = `${match[1]}${nextSymbols
    .map((symbol) => `    '${symbol}',`)
    .join('\n')}${match[3]}`;

  return content.replace(blockPattern, nextBlock);
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

  let content = fs.readFileSync(contractFile, 'utf8');

  for (const target of plan.targets) {
    content = renderSynchronizedPublicSymbolContract({
      content,
      plan,
      target,
    });
  }

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

    if (current !== expected) {
      driftedFiles.push(contractFile);
    }
  }

  return driftedFiles;
}
