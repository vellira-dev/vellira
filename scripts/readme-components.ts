import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ComponentMetadata } from '../packages/metadata/src/component';
import { componentMetadata } from '../packages/metadata/src/components';

const START_MARKER = '<!-- vellira:component-inventory:start -->';
const END_MARKER = '<!-- vellira:component-inventory:end -->';
const PORTAL_NAME = 'Portal';
const ENABLED = '✅';
const DISABLED = '—';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = resolve(repoRoot, 'README.md');

type ComponentPlatform = ComponentMetadata['platforms'][number];

interface ReadmeComponentRow {
  name: string;
  react: string;
  reactNative: string;
}

function compareNames(left: ComponentMetadata, right: ComponentMetadata): number {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function platformCell(
  metadata: ComponentMetadata,
  platform: ComponentPlatform
): string {
  return metadata.platforms.includes(platform) ? ENABLED : DISABLED;
}

function extractInventoryBlock(readme: string): string {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error('README component inventory markers are missing or invalid.');
  }

  return readme.slice(start, end + END_MARKER.length);
}

function parseInventoryRows(block: string): ReadmeComponentRow[] {
  const rows: ReadmeComponentRow[] = [];

  for (const line of block.split('\n')) {
    if (!line.startsWith('|')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [name, react, reactNative] = cells;

    if (name === 'Component' || name?.startsWith('---')) continue;
    if (!name || !react || !reactNative || cells.length !== 3) {
      throw new Error(`Invalid README component inventory row: ${line}`);
    }

    rows.push({ name, react, reactNative });
  }

  return rows;
}

export function validateReadmeComponentInventory(
  readme: string,
  metadata: readonly ComponentMetadata[] = componentMetadata
): string[] {
  const block = extractInventoryBlock(readme);
  const rows = parseInventoryRows(block);
  const expected = metadata.filter(({ layer }) => layer === 'components');
  expected.sort(compareNames);

  const errors: string[] = [];
  const rowByName = new Map<string, ReadmeComponentRow>();

  for (const row of rows) {
    if (rowByName.has(row.name)) {
      errors.push(`Duplicate README component: ${row.name}`);
      continue;
    }
    rowByName.set(row.name, row);
  }

  const expectedNames = new Set(expected.map(({ name }) => name));

  for (const component of expected) {
    const row = rowByName.get(component.name);
    if (!row) {
      errors.push(`Missing README component: ${component.name}`);
      continue;
    }

    const expectedReact = platformCell(component, 'react');
    const expectedNative = platformCell(component, 'react-native');

    if (row.react !== expectedReact) {
      errors.push(`README React support mismatch: ${component.name}`);
    }
    if (row.reactNative !== expectedNative) {
      errors.push(`README React Native support mismatch: ${component.name}`);
    }
  }

  for (const row of rows) {
    if (!expectedNames.has(row.name)) {
      errors.push(`Extra README component: ${row.name}`);
    }
  }

  const actualOrder = rows.map(({ name }) => name).join('\n');
  const expectedOrder = expected.map(({ name }) => name).join('\n');
  if (actualOrder !== expectedOrder) {
    errors.push('README component inventory order must match canonical metadata.');
  }

  const portalIsCanonical = expectedNames.has(PORTAL_NAME);
  const portalIsSupportPrimitive =
    block.includes('`Portal`') && block.includes('support primitives');

  if (!portalIsCanonical && !portalIsSupportPrimitive) {
    errors.push('README must classify Portal as support infrastructure.');
  }
  if (portalIsCanonical && portalIsSupportPrimitive) {
    errors.push('README Portal support-primitive note is stale.');
  }

  return errors;
}

export async function checkReadmeComponentInventory(): Promise<void> {
  const readme = await readFile(readmePath, 'utf8');
  const errors = validateReadmeComponentInventory(readme);

  if (errors.length > 0) {
    throw new Error(
      ['README component inventory is stale:', ...errors].join('\n')
    );
  }

  const count = componentMetadata.filter(
    ({ layer }) => layer === 'components'
  ).length;
  console.log(`README component inventory: PASS (${count} components)`);
}
