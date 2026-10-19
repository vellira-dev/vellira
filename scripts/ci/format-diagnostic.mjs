// Transient diagnostics only: emit canonical Prettier formatting on the CI runner.
// The original blocking prettier --check runs immediately afterward.
import { readFile } from 'node:fs/promises';
import prettier from 'prettier';

const targets = [
  'apps/website/src/sections/home/PlatformParity/PlatformParity.tsx',
  'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx',
  'examples/workspace-starter/native/App.tsx',
  'examples/workspace-starter/native/tsconfig.json',
  'examples/workspace-starter/README.md',
  'examples/workspace-starter/web/src/App.tsx',
  'examples/workspace-starter/web/src/styles.css',
  'examples/workspace-starter/web/tsconfig.json',
  'scripts/website/workspace-starter.test.ts',
];

for (const path of targets) {
  const original = await readFile(path, 'utf8');
  const options = (await prettier.resolveConfig(path)) ?? {};
  const formatted = await prettier.format(original, { ...options, filepath: path });
  if (original === formatted) continue;
  process.stdout.write('VELLIRA_FORMAT_RESULT:' + JSON.stringify({ path, content: formatted }) + ':VELLIRA_FORMAT_END\n');
}
