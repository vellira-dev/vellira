import fs from 'node:fs';

import { describe, expect, it } from 'vitest';
import { format } from 'prettier';

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

describe('Prettier probe', () => {
  it('emits canonical formatting for the four style-only failures', async () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const formatted = await format(source, options);
      console.log(
        `PRETTIER_PROBE:${file}:${Buffer.from(formatted).toString('base64')}`
      );
    }

    expect.fail('Intentional one-run formatter probe.');
  });
});
