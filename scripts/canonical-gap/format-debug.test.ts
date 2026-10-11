import { readFileSync } from 'node:fs';

import * as prettier from 'prettier';
import { it } from 'vitest';

it('prints temporary canonical formatter evidence', async () => {
  const file = 'scripts/canonical-gap/cli.ts';
  const source = readFileSync(file, 'utf8');
  const config = await prettier.resolveConfig(file);
  const formatted = await prettier.format(source, {
    ...config,
    filepath: file,
  });
  const encoded = Buffer.from(formatted, 'utf8').toString('base64');
  for (let index = 0; index < encoded.length; index += 160) {
    console.log(
      'FORMATTED_CLI_' +
        String(index / 160).padStart(3, '0') +
        '=' +
        encoded.slice(index, index + 160)
    );
  }
});
