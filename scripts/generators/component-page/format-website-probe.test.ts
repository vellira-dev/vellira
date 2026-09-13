import fs from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';
import { expect, it } from 'vitest';

it('keeps generated website orchestration Prettier-clean', async () => {
  const file = path.join(
    process.cwd(),
    'scripts/generators/component/website.ts'
  );
  const source = fs.readFileSync(file, 'utf8');
  const config = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, {
    ...config,
    filepath: file,
  });

  if (source !== formatted) {
    console.log(`VELLIRA_FORMATTED_WEBSITE_START\n${formatted}VELLIRA_FORMATTED_WEBSITE_END`);
  }

  expect(source).toBe(formatted);
});
