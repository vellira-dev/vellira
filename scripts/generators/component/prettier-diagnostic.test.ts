import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as prettier from 'prettier';
import { expect, it } from 'vitest';

const targets = [
  'scripts/generators/component/component-presentation.test.ts',
  'scripts/generators/component/presentation-contract.test.ts',
  'scripts/generators/component/templates/component-story.ts',
  'scripts/generators/component/website.ts',
] as const;

it('prints canonical Prettier diffs for presentation files', async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-prettier-diagnostic-')
  );
  const diffs: string[] = [];

  try {
    for (const target of targets) {
      const source = fs.readFileSync(target, 'utf8');
      const config = (await prettier.resolveConfig(target)) ?? {};
      const formatted = await prettier.format(source, {
        ...config,
        filepath: target,
      });

      if (source === formatted) {
        continue;
      }

      const tempFile = path.join(tempRoot, path.basename(target));
      fs.writeFileSync(tempFile, formatted);
      const result = spawnSync('git', ['diff', '--no-index', '--', target, tempFile], {
        encoding: 'utf8',
      });
      diffs.push(result.stdout);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  if (diffs.length > 0) {
    console.error(`CANONICAL_PRETTIER_DIFF\n${diffs.join('\n')}`);
  }

  expect(diffs).toEqual([]);
});
