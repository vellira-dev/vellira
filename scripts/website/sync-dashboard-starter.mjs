// Keep the standalone Vite starter as the editable source of this free demo.
// The website copy is checked in so that its deployment has no runtime file copying.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const web = resolve(root, 'examples/workspace-starter/web/src');
const site = resolve(root, 'apps/website/src/sections/home/ProductInterfaceDemo');
const source = readFileSync(resolve(web, 'Dashboard.tsx'), 'utf8');
const expectedJsx = source.replace(
  "from './model';",
  "from '../../../../../../examples/workspace-starter/web/src/model';"
);
if (expectedJsx === source) {
  throw new Error('Expected standalone Dashboard model import was not found');
}
const expectedCss = readFileSync(resolve(web, 'Dashboard.module.css'), 'utf8');
const files = [
  [resolve(site, 'Dashboard.tsx'), expectedJsx],
  [resolve(site, 'Dashboard.module.css'), expectedCss],
];
if (process.argv.includes('--check')) {
  for (const [file, expected] of files) {
    if (readFileSync(file, 'utf8') !== expected) {
      throw new Error(
        `Dashboard copies diverged: ${file}. Run node scripts/website/sync-dashboard-starter.mjs`
      );
    }
  }
  console.info('Website Dashboard mirrors standalone Starter source.');
} else {
  for (const [file, expected] of files) writeFileSync(file, expected);
  console.info('Website Dashboard updated from standalone Starter.');
}
