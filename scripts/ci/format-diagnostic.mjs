// Transient: emit exact canonical Prettier results for changed dashboard source.
// The real blocking prettier --check still executes immediately afterward.
import { readFile } from 'node:fs/promises';
import prettier from 'prettier';

const files = [
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.tsx',
  'examples/workspace-starter/web/src/Dashboard.tsx',
  'scripts/website/live-dashboard-core-showcase.test.ts',
];
for (const path of files) {
  const text = await readFile(path, 'utf8');
  const options = (await prettier.resolveConfig(path)) ?? {};
  const formatted = await prettier.format(text, { ...options, filepath: path });
  if (formatted !== text) {
    process.stdout.write('VELLIRA_FORMAT_RESULT:' + JSON.stringify({ path, content: formatted }) + ':VELLIRA_FORMAT_END\n');
  }
}
