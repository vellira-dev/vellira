import fs from 'node:fs';
import path from 'node:path';

import type { ComponentGenerationPlan } from './plan';

type ReadmeInventoryPlan = Pick<
  ComponentGenerationPlan,
  'root' | 'componentName' | 'targets'
>;

type ReadmeInventoryMutationResult = {
  updatedFiles: string[];
};

const START_MARKER = '<!-- vellira:component-inventory:start -->';
const END_MARKER = '<!-- vellira:component-inventory:end -->';
const ENABLED = '✅';
const DISABLED = '—';

type Row = {
  name: string;
  react: string;
  reactNative: string;
};

export function getReadmeInventoryFile(root: string): string {
  return path.join(root, 'README.md');
}

function parseRow(line: string): Row {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  const [name, react, reactNative] = cells;

  if (!name || !react || !reactNative || cells.length !== 3) {
    throw new Error(`component-readme-inventory-row-invalid: ${line}`);
  }

  return { name, react, reactNative };
}

function componentRow(plan: ReadmeInventoryPlan): Row {
  const platforms = new Set(plan.targets.map(({ packageName }) => packageName));

  return {
    name: plan.componentName,
    react: platforms.has('react') ? ENABLED : DISABLED,
    reactNative: platforms.has('react-native') ? ENABLED : DISABLED,
  };
}

function compareRows(left: Row, right: Row): number {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function renderRow(row: Row, width: number): string {
  const name = row.name.padEnd(width);
  return `| ${name} |  ${row.react}   |      ${row.reactNative}      |`;
}

export function renderSynchronizedReadmeInventory(
  readme: string,
  plan: ReadmeInventoryPlan
): string {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error('component-readme-inventory-markers-invalid');
  }

  const block = readme.slice(start, end + END_MARKER.length);
  const lines = block.split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith('| Component'));

  if (
    headerIndex === -1 ||
    !lines[headerIndex + 1]?.startsWith('|') ||
    !lines[headerIndex + 1]?.includes(':---:')
  ) {
    throw new Error('component-readme-inventory-table-invalid');
  }

  let rowEnd = headerIndex + 2;
  const rows: Row[] = [];

  while (rowEnd < lines.length && lines[rowEnd]!.startsWith('|')) {
    rows.push(parseRow(lines[rowEnd]!));
    rowEnd += 1;
  }

  const nextRow = componentRow(plan);
  const byName = new Map(rows.map((row) => [row.name, row]));
  byName.set(nextRow.name, nextRow);

  const nextRows = [...byName.values()].sort(compareRows);
  const width = Math.max(
    'Component'.length,
    ...nextRows.map(({ name }) => name.length)
  );
  const table = [
    `| ${'Component'.padEnd(width)} | React | React Native |`,
    `| ${'-'.repeat(width)} | :---: | :----------: |`,
    ...nextRows.map((row) => renderRow(row, width)),
  ];

  lines.splice(headerIndex, rowEnd - headerIndex, ...table);

  const nextBlock = lines.join('\n');
  const prefix = readme.slice(0, start);
  const suffix = readme.slice(end + END_MARKER.length);

  return `${prefix}${nextBlock}${suffix}`;
}

type ReadmeInventoryMaterialization = {
  file: string;
  current: string;
  expected: string;
};

function materializeReadmeInventoryContract(
  plan: ReadmeInventoryPlan
): ReadmeInventoryMaterialization {
  const file = getReadmeInventoryFile(plan.root);

  if (!fs.existsSync(file)) {
    throw new Error('component-readme-inventory-file-missing: README.md');
  }

  const current = fs.readFileSync(file, 'utf8');

  return {
    file,
    current,
    expected: renderSynchronizedReadmeInventory(current, plan),
  };
}

export function validateReadmeInventoryMaterialization(
  plan: ReadmeInventoryPlan
): string[] {
  try {
    materializeReadmeInventoryContract(plan);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

export function checkReadmeInventoryContract(
  plan: ReadmeInventoryPlan
): string[] {
  const { file, current, expected } = materializeReadmeInventoryContract(plan);

  return current === expected ? [] : [path.relative(plan.root, file)];
}

export function synchronizeReadmeInventoryContract(params: {
  plan: ReadmeInventoryPlan;
  result: ReadmeInventoryMutationResult;
}): void {
  const { file, current, expected } = materializeReadmeInventoryContract(
    params.plan
  );

  if (current === expected) return;

  fs.writeFileSync(file, expected);

  if (!params.result.updatedFiles.includes(file)) {
    params.result.updatedFiles.push(file);
  }
}
