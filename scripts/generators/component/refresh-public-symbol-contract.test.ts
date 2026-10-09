import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { refreshSharedSymbolInventory } from './refresh-public-symbol-contract';

const roots: string[] = [];
const spec = {
  schemaVersion: '1',
  componentName: 'Notice',
  platform: 'both',
  layer: 'components',
  category: 'feedback',
  profile: 'base',
  capabilities: ['controlled'],
  componentTokens: 'standard',
  parts: [],
};
function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-shared-inventory-')
  );
  roots.push(root);
  const inventory = path.join(root, 'scripts/check-public-api.mjs');
  const authority = path.join(root, 'packages/types/src/notice.ts');
  fs.mkdirSync(path.dirname(inventory), { recursive: true });
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    inventory,
    "const publicSymbolContracts = {\n  'packages/types/src/index.ts': [\n    'Existing',\n  ],\n};\n"
  );
  fs.writeFileSync(
    authority,
    "export type NoticeTone = 'neutral' | 'warning';\nexport interface BaseNoticeProps { tone?: NoticeTone }\n"
  );
  return { root, inventory, authority };
}
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

it('checks without writes, changes only the derived inventory, and is idempotent', () => {
  const { root, inventory, authority } = fixture();
  const before = fs.readFileSync(inventory, 'utf8');
  const source = fs.readFileSync(authority, 'utf8');
  expect(refreshSharedSymbolInventory(root, spec, true).changedPaths).toEqual([
    'scripts/check-public-api.mjs',
  ]);
  expect(fs.readFileSync(inventory, 'utf8')).toBe(before);
  expect(refreshSharedSymbolInventory(root, spec, false).changedPaths).toEqual([
    'scripts/check-public-api.mjs',
  ]);
  expect(fs.readFileSync(inventory, 'utf8')).toContain("    'NoticeTone',");
  expect(fs.readFileSync(inventory, 'utf8')).toContain(
    "    'BaseNoticeProps',"
  );
  expect(fs.readFileSync(authority, 'utf8')).toBe(source);
  expect(refreshSharedSymbolInventory(root, spec, false).changedPaths).toEqual(
    []
  );
  expect(refreshSharedSymbolInventory(root, spec, true).changedPaths).toEqual(
    []
  );
});

it('requires a materialized shared authority and an existing exact inventory block', () => {
  const { root, inventory } = fixture();
  const before = fs.readFileSync(inventory, 'utf8');
  expect(() =>
    refreshSharedSymbolInventory(
      root,
      { ...spec, componentName: 'Missing' },
      false
    )
  ).toThrow('Materialized shared type authority');
  expect(fs.readFileSync(inventory, 'utf8')).toBe(before);
  fs.writeFileSync(inventory, 'const publicSymbolContracts = {};\n');
  expect(() => refreshSharedSymbolInventory(root, spec, false)).toThrow(
    'Unable to locate'
  );
  expect(fs.readFileSync(inventory, 'utf8')).toBe(
    'const publicSymbolContracts = {};\n'
  );
});

it.each(['inventory', 'authority'] as const)(
  'rejects a symlinked %s before writes',
  (field) => {
    const fixturePaths = fixture();
    const file = fixturePaths[field];
    const target = file + '.original';
    fs.renameSync(file, target);
    fs.symlinkSync(target, file);
    const before = fs.readFileSync(target, 'utf8');
    expect(() =>
      refreshSharedSymbolInventory(fixturePaths.root, spec, false)
    ).toThrow('symlink');
    expect(fs.readFileSync(target, 'utf8')).toBe(before);
  }
);

it('rejects symlinked parent directories before inventory mutation', () => {
  const { root, inventory } = fixture();
  const before = fs.readFileSync(inventory, 'utf8');
  const original = path.join(root, 'packages/types/src');
  fs.renameSync(original, original + '-target');
  fs.symlinkSync(original + '-target', original);
  expect(() => refreshSharedSymbolInventory(root, spec, false)).toThrow(
    'symlink'
  );
  expect(fs.readFileSync(inventory, 'utf8')).toBe(before);
});
