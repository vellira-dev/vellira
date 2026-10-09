import { spawnSync } from 'node:child_process';

import { componentPageScriptCommand } from './helpers/command';

const [auditExecutable, ...auditArgs] = componentPageScriptCommand(
  'audit-catalog-previews.ts'
);
const previewAudit = spawnSync(auditExecutable, auditArgs, {
  stdio: 'inherit',
});

if (previewAudit.status !== 0) {
  process.exit(previewAudit.status ?? 1);
}

const [executable, ...args] = componentPageScriptCommand(
  'generate-component-pages.ts',
  ['--check']
);
const result = spawnSync(executable, args, {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
