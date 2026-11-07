import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { copyFixtureSource } from './fixture-source';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

it('copies authored files without traversing nested dependencies or build output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'page-source-contract-'));
  roots.push(root);
  const source = path.join(root, 'source');
  const fixture = path.join(root, 'fixture');
  const files = {
    'apps/website/src/page.tsx': 'authored page',
    'apps/website/src/dist-notes.md': 'authored documentation',
    'apps/website/node_modules/runtime/bin/tool': 'installed binary',
    'apps/website/.next/cache/generated': 'generated cache',
    'packages/ui/src/index.ts': 'authored export',
    'packages/ui/dist/index.js': 'generated build',
    'packages/ui/coverage/index.html': 'generated coverage',
    'package.json': '{"private":true}',
  };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(source, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.mkdirSync(path.join(source, 'apps/docs'), { recursive: true });
  fs.symlinkSync(
    path.join(source, 'apps/website/node_modules'),
    path.join(source, 'apps/docs/node_modules'),
    'dir'
  );

  for (const relative of ['apps', 'packages', 'package.json', 'missing.json'])
    copyFixtureSource(source, fixture, relative);

  for (const relative of [
    'apps/website/src/page.tsx',
    'apps/website/src/dist-notes.md',
    'packages/ui/src/index.ts',
    'package.json',
  ])
    expect(fs.readFileSync(path.join(fixture, relative), 'utf8')).toBe(
      files[relative as keyof typeof files]
    );

  for (const relative of [
    'apps/website/node_modules',
    'apps/docs/node_modules',
    'apps/website/.next',
    'packages/ui/dist',
    'packages/ui/coverage',
    'missing.json',
  ])
    expect(fs.existsSync(path.join(fixture, relative)), relative).toBe(false);

  // Copying a fixture may not delete or rewrite the shared installed graph.
  expect(
    fs.readFileSync(
      path.join(source, 'apps/website/node_modules/runtime/bin/tool'),
      'utf8'
    )
  ).toBe('installed binary');
});
