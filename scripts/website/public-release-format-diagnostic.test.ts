import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { it } from 'vitest';

// Temporary exact-source formatting diagnostic. Removed before merge.
it('prints exact Prettier differences for npm release surfaces', () => {
  const files = [
    'apps/website/src/sections/home/Roadmap/Roadmap.tsx',
    'scripts/public-release/client.ts',
    'scripts/website/public-release-api.test.ts',
    'scripts/website/public-release-client.test.ts',
    'scripts/website/public-release-surfaces.test.ts',
  ];
  const folder = mkdtempSync(join(tmpdir(), 'vellira-public-release-format-'));
  const output: string[] = [];

  try {
    for (const file of files) {
      const original = readFileSync(file, 'utf8');
      const formatted = execFileSync(
        'pnpm',
        ['exec', 'prettier', '--stdin-filepath', file],
        { input: original, encoding: 'utf8' }
      );
      if (original === formatted) continue;

      const expectedFile = join(folder, 'formatted.txt');
      writeFileSync(expectedFile, formatted);
      const result = spawnSync('diff', ['-u', file, expectedFile], {
        encoding: 'utf8',
      });
      output.push(`=== ${file} ===\n${result.stdout}`);
    }

    if (output.length > 0) {
      throw new Error(
        `EXACT_FORMAT_DIFF_START\n${output.join('\n')}\nEXACT_FORMAT_DIFF_END`
      );
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
