import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const tasks = [
  {
    name: 'tooling suite',
    args: [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.tooling.config.ts',
      '--exclude',
      'scripts/checks/token-semantic/cli.test.ts',
      '--exclude',
      'scripts/component-production/e2e-fixtures.test.ts',
    ],
  },
  {
    name: 'token semantic CLI integration',
    args: [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.tooling.config.ts',
      'scripts/checks/token-semantic/cli.test.ts',
    ],
  },
  {
    name: 'component production fixtures A',
    args: [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.tooling.config.ts',
      'scripts/component-production/e2e-fixtures.test.ts',
      '--testNamePattern',
      'boolean-form-control|compound-divergent',
    ],
  },
  {
    name: 'component production fixtures B',
    args: [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.tooling.config.ts',
      'scripts/component-production/e2e-fixtures.test.ts',
      '--testNamePattern',
      'base-web|overlay-web|base-cross-platform|rejects invalid resources|blocks compound completeness',
    ],
  },
];

function runTask(task) {
  return new Promise((resolve) => {
    const child = spawn(pnpmCommand, task.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (error) => {
      console.error(`[tooling] ${task.name} failed to start:`, error);
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[tooling] ${task.name} terminated by ${signal}.`);
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

const results = await Promise.all(tasks.map(runTask));
const exitCode = Math.max(...results);

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
