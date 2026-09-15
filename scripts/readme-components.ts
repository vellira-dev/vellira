import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import type { ComponentMetadata } from '../packages/metadata/src/component';
import { componentMetadata } from '../packages/metadata/src/components';

const START_MARKER = '<!-- vellira:component-inventory:start -->';
const END_MARKER = '<!-- vellira:component-inventory:end -->';
const PORTAL_NOTE =
  '> `Portal` and `PortalProvider` are support primitives used by overlay components. They are public package infrastructure, not canonical catalog components.';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), '..');
const readmePath = resolve(repoRoot, 'README.md');

type ComponentPlatform = ComponentMetadata['platforms'][number];

function compareNames(left: ComponentMetadata, right: ComponentMetadata): number {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function platformCell(
  metadata: ComponentMetadata,
  platform: ComponentPlatform
): string {
  return metadata.platforms.includes(platform) ? '✅' : '—';
}

function renderInventoryRow(metadata: ComponentMetadata): string {
  const react = platformCell(metadata, 'react');
  const native = platformCell(metadata, 'react-native');
  return `| ${metadata.name} | ${react} | ${native} |`;
}

export function renderComponentInventory(
  metadata: readonly ComponentMetadata[] = componentMetadata
): string {
  const components = metadata.filter(({ layer }) => layer === 'components');
  components.sort(compareNames);

  const hasPortalComponent = components.some(({ name }) => name === 'Portal');
  const lines = [
    START_MARKER,
    '',
    'Platform availability is derived from the canonical component metadata registry.',
    '',
  ];

  if (!hasPortalComponent) {
    lines.push(PORTAL_NOTE, '');
  }

  lines.push(
    '| Component | React | React Native |',
    '| --- | :---: | :---: |',
    ...components.map(renderInventoryRow),
    '',
    END_MARKER
  );

  return lines.join('\n');
}

export function replaceComponentInventory(
  readme: string,
  inventory = renderComponentInventory()
): string {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    const message =
      `README component inventory markers are missing or invalid. ` +
      `Expected ${START_MARKER} and ${END_MARKER}.`;
    throw new Error(message);
  }

  const afterEnd = end + END_MARKER.length;
  return `${readme.slice(0, start)}${inventory}${readme.slice(afterEnd)}`;
}

async function expectedReadme(readme: string): Promise<string> {
  return format(replaceComponentInventory(readme), { filepath: readmePath });
}

export async function checkReadmeComponentInventory(): Promise<void> {
  const readme = await readFile(readmePath, 'utf8');
  const expected = await expectedReadme(readme);

  if (readme !== expected) {
    const message =
      'README component inventory is stale. Run ' +
      '`node --import tsx scripts/readme-components.ts` and commit the result.';
    throw new Error(message);
  }

  const count = componentMetadata.length;
  console.log(`README component inventory: PASS (${count} canonical components)`);
}

export async function generateReadmeComponentInventory(): Promise<void> {
  const readme = await readFile(readmePath, 'utf8');
  const expected = await expectedReadme(readme);

  if (readme === expected) {
    console.log('README component inventory is already current.');
    return;
  }

  await writeFile(readmePath, expected, 'utf8');
  const count = componentMetadata.length;
  console.log(`Updated README component inventory from ${count} canonical components.`);
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes('--check')) {
    await checkReadmeComponentInventory();
    return;
  }

  await generateReadmeComponentInventory();
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
