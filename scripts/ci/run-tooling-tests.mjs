import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const splitProductionFixtures =
  process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_JOB === 'tooling';

const baseArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  'vitest.tooling.config.ts',
  '--exclude',
  'scripts/checks/token-semantic/cli.test.ts',
];

if (splitProductionFixtures) {
  baseArgs.push('--exclude', 'scripts/component-production/e2e-fixtures.test.ts');
}

const tasks = [
  {
    name: 'Actions workflow contracts',
    args: ['exec', 'node', '--test', 'scripts/ci/workflow-noise.test.mjs'],
  },
  {
    name: 'package smoke authority contracts',
    args: ['exec', 'node', '--test', 'scripts/smoke/utils.test.mjs'],
  },
  {
    name: 'tooling suite',
    args: baseArgs,
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

for (const task of tasks) {
  const exitCode = await runTask(task);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    break;
  }
}
