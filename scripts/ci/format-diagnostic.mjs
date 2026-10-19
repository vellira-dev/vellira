// Transient format diagnostics — removed with the canonical formatted update.
import { readFile } from 'node:fs/promises';
import prettier from 'prettier';

const paths = [
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.tsx',
  'examples/workspace-starter/web/src/Dashboard.tsx',
];

for (const path of paths) {
  const source = await readFile(path, 'utf8');
  const options = (await prettier.resolveConfig(path)) ?? {};
  const formatted = await prettier.format(source, { ...options, filepath: path });
  if (source !== formatted) {
    process.stdout.write('VELLIRA_FORMAT_RESULT:' + JSON.stringify({ path, content: formatted }) + ':VELLIRA_FORMAT_END\n');
  }
}
