import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { it } from 'vitest';

// TEMPORARY exact formatting diagnostic, removed after reconciling evidence.
it('reports precise Prettier diffs for homepage sources', () => {
  const files = [
    'apps/website/src/sections/home/CodeShowcase/CodeShowcase.tsx',
    'apps/website/src/sections/home/ConsistencyStory/ConsistencyStory.tsx',
    'apps/website/src/sections/home/QuickStart/QuickStart.tsx',
    'apps/website/src/sections/home/Roadmap/Roadmap.tsx',
    'scripts/website/homepage-consistency-story.test.ts',
    'apps/react-storybook/scripts/cloudflare-client-navigation-recovery.mjs',
  ];
  const folder = mkdtempSync(join(tmpdir(), 'vellira-format-probe-'));
  try {
    const reports: string[] = [];
    for (const file of files) {
      const current = readFileSync(file, 'utf8');
      const expected = execFileSync(
        'pnpm',
        ['exec', 'prettier', '--stdin-filepath', file],
        { input: current, encoding: 'utf8' }
      );
      if (current === expected) continue;
      const target = join(folder, 'formatted.txt');
      writeFileSync(target, expected);
      const result = spawnSync('diff', ['-u', file, target], {
        encoding: 'utf8',
      });
      reports.push(file + '\n' + result.stdout);
    }
    if (reports.length > 0) {
      throw new Error('EXACT_PRETTIER_DIFFS_BEGIN\n' + reports.join('\n') + '\nEXACT_PRETTIER_DIFFS_END');
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
