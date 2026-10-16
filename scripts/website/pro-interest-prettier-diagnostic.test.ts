import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { format, resolveConfig } from 'prettier';
import { it } from 'vitest';

// Temporary PR-only diagnostic. Must be removed before marking Ready.
it('emits exact Prettier diff for Pro consent changed files', async () => {
  const targets = [
    'apps/website/PRO_INTEREST_ROLLOUT.md',
    'apps/website/src/sections/home/Pro/ProInterestSignup.tsx',
    'scripts/website/homepage-launch-surface.test.ts',
    'scripts/website/pro-interest-signup.test.tsx',
  ];
  const temp = mkdtempSync(join(tmpdir(), 'vellira-prettier-'));
  try {
    for (const [i, path] of targets.entries()) {
      const actual = readFileSync(path, 'utf8');
      const expected = await format(actual, {
        ...(await resolveConfig(path)),
        filepath: path,
      });
      if (expected === actual) continue;
      const outputPath = join(temp, String(i) + '-' + basename(path));
      writeFileSync(outputPath, expected, 'utf8');
      const result = spawnSync('diff', ['-u', path, outputPath], {
        encoding: 'utf8',
      });
      console.log('PRETTIER_DIFF_START: ' + path);
      console.log(result.stdout);
      console.log('PRETTIER_DIFF_END: ' + path);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
