// Temporary, read-only CI evidence probe. Deleted before review/merge.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import prettier from 'prettier';
import { it } from 'vitest';

it('captures canonical format and deterministic catalog regeneration for #1590', async () => {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const root = process.cwd();
  const inputs = [
    'scripts/generators/component-page/renderers/api.ts',
    'scripts/generators/component-page/renderers/usage.ts',
    'scripts/generators/component-page/renderers/usage.test.ts',
  ];
  for (const relative of inputs) {
    const filePath = path.join(root, relative);
    const configuration = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(fs.readFileSync(filePath, 'utf8'), {
      ...configuration,
      filepath: filePath,
    });
    console.log(
      'VELLIRA_1590_FORMAT ' +
        JSON.stringify({ path: relative, b64: Buffer.from(formatted).toString('base64') })
    );
  }
  if (process.env.GITHUB_JOB !== 'generator-blog') return;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-1590-'));
  const isolated = path.join(temp, 'checkout');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', isolated, 'HEAD'], {
      cwd: root,
      timeout: 30_000,
    });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(isolated, 'node_modules'), 'dir');
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/generators/component-page/generate-component-pages.ts'],
      {
        cwd: isolated,
        encoding: 'utf8',
        timeout: 240_000,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    if (run.status !== 0) {
      throw new Error('Canonical generator did not complete: ' +
        (run.stderr + '\n' + run.stdout).slice(-7000));
    }
    const changed = execFileSync('git', ['diff', '--name-only'], {
      cwd: isolated,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
    for (const relative of changed) {
      if (!relative.startsWith('apps/website/src/component-catalog/components/')) {
        throw new Error('Unexpected generator write outside catalog component: ' + relative);
      }
      const payload = fs.readFileSync(path.join(isolated, relative));
      console.log(
        'VELLIRA_1590_GENERATED ' +
          JSON.stringify({ path: relative, b64: payload.toString('base64') })
      );
    }
    console.log('VELLIRA_1590_SUMMARY ' + JSON.stringify({ count: changed.length, paths: changed }));
  } finally {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', isolated], {
        cwd: root,
        timeout: 30_000,
      });
    } catch {
      // A failed cleanup never promotes production artifacts.
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 280_000);
