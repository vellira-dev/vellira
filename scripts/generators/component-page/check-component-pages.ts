import { spawnSync } from 'node:child_process';

const previewAudit = spawnSync(
  'pnpm',
  [
    'exec',
    'tsx',
    'scripts/generators/component-page/audit-catalog-previews.ts',
  ],
  {
    stdio: 'inherit',
  }
);

if (previewAudit.status !== 0) {
  process.exit(previewAudit.status ?? 1);
}

const result = spawnSync('pnpm', ['component-pages:generate', '--check'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
