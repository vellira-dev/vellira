// Diagnostic-only script: emit exact output of the repository's Prettier.
// Removed after applying the canonical six source files; quality still blocks.
import { readFile } from 'node:fs/promises';
import prettier from 'prettier';

const targets = [
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.module.css',
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.tsx',
  'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx',
  'examples/workspace-starter/web/src/Dashboard.module.css',
  'examples/workspace-starter/web/src/Dashboard.tsx',
  'scripts/website/live-dashboard-core-showcase.test.ts',
];
for (const path of targets) {
  const original = await readFile(path, 'utf8');
  const options = (await prettier.resolveConfig(path)) ?? {};
  const formatted = await prettier.format(original, { ...options, filepath: path });
  if (original !== formatted) {
    process.stdout.write('VELLIRA_FORMAT_RESULT:' + JSON.stringify({ path, content: formatted }) + ':VELLIRA_FORMAT_END\n');
  }
}
