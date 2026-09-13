import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

import type { ComponentProductionInputV1 } from './contracts';
import { runComponentProductionGeneration } from './generation';

const repositoryRoot = process.cwd();
const input: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'E2EDiagnosticProbe',
  platform: 'web',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: false,
  parts: [],
};

describe('temporary component production E2E diagnostics', () => {
  it('prints formatter and generation diagnostics', async () => {
    const target = path.join(
      repositoryRoot,
      'scripts/component-production/e2e-fixtures.test.ts'
    );
    const source = fs.readFileSync(target, 'utf8');
    const config = (await prettier.resolveConfig(target)) ?? {};
    const formatted = await prettier.format(source, {
      ...config,
      filepath: target,
    });

    console.error(
      `E2E_PRETTIER_BASE64=${Buffer.from(formatted).toString('base64')}`
    );

    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-component-e2e-diagnostic-')
    );
    const root = path.join(parent, 'repo');

    try {
      const add = spawnSync(
        'git',
        [
          '-c',
          `safe.directory=${repositoryRoot}`,
          'worktree',
          'add',
          '--detach',
          root,
          'HEAD',
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          shell: false,
        }
      );

      expect(add.status, add.stderr).toBe(0);
      linkInstalledDependencies(root);

      const generation = await runComponentProductionGeneration({ root, input });
      console.error(
        `E2E_GENERATION_DIAGNOSTIC=${JSON.stringify(generation.generation)}`
      );
      expect(generation.preflight.status).toBe('passed');
    } finally {
      spawnSync(
        'git',
        [
          '-c',
          `safe.directory=${repositoryRoot}`,
          'worktree',
          'remove',
          '--force',
          root,
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          shell: false,
        }
      );
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }, 120_000);
});

function linkInstalledDependencies(root: string) {
  linkDirectory(
    path.join(repositoryRoot, 'node_modules'),
    path.join(root, 'node_modules')
  );

  for (const collection of ['apps', 'packages']) {
    const sourceCollection = path.join(repositoryRoot, collection);

    for (const entry of fs.readdirSync(sourceCollection, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) {
        continue;
      }

      linkDirectory(
        path.join(sourceCollection, entry.name, 'node_modules'),
        path.join(root, collection, entry.name, 'node_modules')
      );
    }
  }
}

function linkDirectory(source: string, target: string) {
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    source,
    target,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}
