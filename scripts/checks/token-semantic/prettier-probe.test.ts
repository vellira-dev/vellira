import fs from 'node:fs';
import path from 'node:path';

import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

const files = [
  'packages/tokens/src/component-token-dependencies.ts',
  'scripts/checks/token-semantic/factory-convention.test.ts',
  'scripts/checks/token-semantic/factory-convention.ts',
  'scripts/checks/token-semantic/semantic-dependency.ts',
] as const;

const options = {
  parser: 'typescript',
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  jsxSingleQuote: true,
  printWidth: 80,
  useTabs: false,
  tabWidth: 2,
  endOfLine: 'lf',
} as const;

const outputRoot = 'apps/react-storybook/test-results/prettier-probe';

describe('Prettier probe', () => {
  it('writes canonical formatting into the existing Playwright artifact path', async () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const formatted = await format(source, options);
      const output = path.join(outputRoot, file);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, formatted);
    }

    expect.fail('Intentional one-run formatter probe.');
  });
});
