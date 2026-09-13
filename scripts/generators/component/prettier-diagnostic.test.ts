import fs from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const targets = [
  'scripts/generators/component/public-api-contract.ts',
  'scripts/generators/component/public-symbol-contract.test.ts',
] as const;

describe('temporary prettier diagnostic', () => {
  it('prints canonical formatter output', async () => {
    for (const target of targets) {
      const content = fs.readFileSync(path.resolve(target), 'utf8');
      const formatted = await prettier.format(content, {
        filepath: target,
      });

      console.log(`PRETTIER_BEGIN:${target}\n${formatted}PRETTIER_END:${target}`);
      expect(formatted).toBe(content);
    }
  });
});
