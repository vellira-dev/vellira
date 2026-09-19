import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  copyWorkerdPackages,
  transformBuildCondition,
  transformPackageJson,
} from '../../../node_modules/@opennextjs/cloudflare/dist/cli/build/utils/workerd.js';

test('OpenNext preserves string shorthand exports and imports without a workerd condition', () => {
  const shorthand = './index.js';

  assert.deepEqual(transformBuildCondition(shorthand, 'workerd'), {
    transformedExports: shorthand,
    hasBuildCondition: false,
  });
  assert.deepEqual(transformPackageJson({ name: 'fixture', exports: shorthand, imports: shorthand }), {
    transformed: { name: 'fixture', exports: shorthand, imports: shorthand },
    hasBuildCondition: false,
  });
});

test('OpenNext keeps conditional workerd exports, nested conditions, and absent values', () => {
  const exports = {
    '.': {
      import: { workerd: './worker.mjs', default: './browser.mjs' },
      require: './index.cjs',
    },
  };

  assert.deepEqual(transformPackageJson({ name: 'fixture', exports }), {
    transformed: {
      name: 'fixture',
      exports: {
        '.': { import: { workerd: './worker.mjs' }, require: './index.cjs' },
      },
    },
    hasBuildCondition: true,
  });
  assert.deepEqual(transformPackageJson({ name: 'fixture', exports: null, imports: null }), {
    transformed: { name: 'fixture', exports: null, imports: null },
    hasBuildCondition: false,
  });
  assert.deepEqual(transformPackageJson({ name: 'fixture' }), {
    transformed: { name: 'fixture' },
    hasBuildCondition: false,
  });
});

test('OpenNext still reports a genuine workerd package copy failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vellira-opennext-copy-failure-'));
  const source = path.join(root, 'node_modules', 'fixture');
  const blockedDestination = path.join(root, 'blocked');
  const destination = path.join(blockedDestination, 'fixture');
  const errors = [];
  const originalError = console.error;

  try {
    await mkdir(path.join(root, '.next'), { recursive: true });
    await mkdir(source, { recursive: true });
    await writeFile(blockedDestination, 'not a directory');
    await writeFile(
      path.join(root, '.next', 'required-server-files.json'),
      JSON.stringify({ config: { serverExternalPackages: ['fixture'] } })
    );
    await writeFile(
      path.join(source, 'package.json'),
      JSON.stringify({ name: 'fixture', exports: { workerd: './worker.js' } })
    );
    console.error = (...args) => errors.push(args.join(' '));

    await copyWorkerdPackages(
      { appBuildOutputPath: root, appPath: root },
      new Map([[source, destination]])
    );
  } finally {
    console.error = originalError;
    await rm(root, { recursive: true, force: true });
  }

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Failed to copy/);
  assert.match(errors[0], /node_modules.*fixture/);
});
