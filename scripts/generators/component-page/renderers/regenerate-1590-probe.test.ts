// Temporary read-only canonical regeneration evidence; removed before merge.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import prettier from 'prettier';
import { it } from 'vitest';

it('records exact #1590 label parity projections and formatted source', async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_JOB !== 'generator-blog') return;
  const root = process.cwd();
  for (const relative of [
    'scripts/generators/component-page/renderers/usage.ts',
    'scripts/generators/component-page/renderers/usage.test.ts',
  ]) {
    const absolute = path.join(root, relative);
    const configuration = await prettier.resolveConfig(absolute);
    const formatted = await prettier.format(fs.readFileSync(absolute, 'utf8'), {
      ...configuration,
      filepath: absolute,
    });
    console.log('VELLIRA_1590_FORMAT ' + JSON.stringify({
      path: relative,
      b64: Buffer.from(formatted).toString('base64'),
    }));
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-1590-labels-'));
  const checkout = path.join(temp, 'checkout');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', checkout, 'HEAD'], {
      cwd: root,
      timeout: 30000,
    });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(checkout, 'node_modules'), 'dir');
    for (const component of ['Input', 'FormField']) {
      const run = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/generators/component-page/create-component-page.ts',
        component, '--force',
      ], { cwd: checkout, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
      if (run.status !== 0) {
        throw new Error('Generator failed for ' + component + ': ' +
          (run.stderr + '\n' + run.stdout).slice(-5000));
      }
    }
    const paths = execFileSync('git', ['diff', '--name-only'], {
      cwd: checkout,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
    const allowed = new Set([
      'apps/website/src/component-catalog/components/Input/InputUsage.tsx',
      'apps/website/src/component-catalog/components/FormField/FormFieldUsage.tsx',
    ]);
    for (const relative of paths) {
      if (!allowed.has(relative)) throw new Error('Generator wrote an unexpected path: ' + relative);
      console.log('VELLIRA_1590_GENERATED ' + JSON.stringify({
        path: relative,
        b64: fs.readFileSync(path.join(checkout, relative)).toString('base64'),
      }));
    }
    if (paths.length !== 2) throw new Error('Expected two updated Usage pages, got: ' + paths.join(','));
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', checkout], { cwd: root, timeout: 30000 }); } catch {}
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 240000);
