import fs from 'node:fs';

import * as prettier from 'prettier';
import { expect, it } from 'vitest';

const files = [
  'scripts/component-production/review-bundle.ts',
  'scripts/component-production/review-bundle.test.ts',
] as const;

it('prints canonical Prettier output for review-bundle files', async () => {
  const changed: string[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const formatted = await prettier.format(source, { filepath: file });

    if (formatted === source) {
      continue;
    }

    console.error(`PRETTIER_CANONICAL_START:${file}`);
    console.error(formatted);
    console.error(`PRETTIER_CANONICAL_END:${file}`);
    changed.push(file);
  }

  expect(changed).toEqual([]);
});
