import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const buildDependencies = JSON.parse(
  readFileSync(
    new URL('./tooling-build-dependencies.json', import.meta.url),
    'utf8'
  )
);
const profile = process.argv[2];
if (profile !== undefined && profile !== '--source-contracts') {
  throw new Error('Unknown tooling execution profile.');
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const splitProductionFixtures = process.env.GITHUB_ACTIONS === 'true';

const baseArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  'vitest.tooling.config.ts',
  '--exclude',
  'scripts/checks/token-semantic/cli.test.ts',
];
if (profile === '--source-contracts') {
  for (const group of buildDependencies) {
    for (const file of group.files) baseArgs.push('--exclude', file);
  }
}

if (splitProductionFixtures) {
  baseArgs.push(
    '--exclude',
    'scripts/component-production/e2e-fixtures.test.ts'
  );
}

const tasks = [
  {
    name: 'canonical visual font contracts',
    args: [
      'exec',
      'node',
      '--test',
      fileURLToPath(
        new URL('../visual/canonical-fonts.test.mjs', import.meta.url)
      ),
    ],
  },
  {
    name: 'Actions workflow contracts',
    args: ['exec', 'node', '--test', 'scripts/ci/workflow-noise.test.mjs'],
  },
  {
    name: 'package smoke authority contracts',
    args: ['exec', 'node', '--test', 'scripts/smoke/utils.test.mjs'],
  },
  {
    name: 'dependency security remediation contracts',
    args: [
      'exec',
      'node',
      '--test',
      'scripts/ci/dependabot-security-remediation.test.mjs',
    ],
  },
  {
    name: 'verified dependency backport contracts',
    args: [
      'exec',
      'node',
      '--test',
      'scripts/ci/dependabot-verified-backports.test.mjs',
    ],
  },
  {
    name: 'Chromatic impact contracts',
    args: ['exec', 'node', '--test', 'scripts/ci/chromatic-impact.test.mjs'],
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
    // Tasks are independent. Preserve every deterministic blocker in this pass.
  }
}
