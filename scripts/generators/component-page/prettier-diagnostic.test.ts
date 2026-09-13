import fs from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const targets = [
  'scripts/generators/component-page/catalog-preview-contract.ts',
  'scripts/generators/component-page/renderers/catalog-preview-registry.test.ts',
  'scripts/generators/component-page/renderers/catalog-preview-registry.ts',
] as const;

describe('temporary catalog preview prettier diagnostic', () => {
  it('prints repository-configured formatter output', async () => {
    let changed = false;

    for (const target of targets) {
      const content = fs.readFileSync(path.resolve(target), 'utf8');
      const config = await prettier.resolveConfig(target);
      const formatted = await prettier.format(content, {
        ...config,
        filepath: target,
      });

      console.log(`PRETTIER_BEGIN:${target}\n${formatted}PRETTIER_END:${target}`);
      changed ||= formatted !== content;
    }

    expect(changed).toBe(false);
  });
});
