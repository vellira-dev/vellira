import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const runProductionFixtureShard =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GITHUB_JOB === 'unit-coverage';

const tasks = [
  ['test:tokens'],
  ['test:core'],
  ['test:metadata'],
  ['test:web'],
  ['test:native'],
];

if (runProductionFixtureShard) {
  tasks.push([
    'exec',
    'turbo',
    'run',
    'build',
    '--filter=@vellira-ui/react',
    '--filter=@vellira-ui/react-native',
    '--filter=@vellira-ui/icons',
  ]);
  tasks.push([
    'exec',
    'vitest',
    'run',
    '--config',
    'vitest.tooling.config.ts',
    'scripts/component-production/e2e-fixtures.test.ts',
    '--testNamePattern',
    'boolean-form-control|compound-divergent',
  ]);
}

function run(args) {
  return new Promise((resolve) => {
    const normalizedArgs = args[0] === 'exec' ? args : ['run', args[0]];
    const child = spawn(pnpmCommand, normalizedArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (error) => {
      console.error(`[unit] ${args.join(' ')} failed to start:`, error);
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[unit] ${args.join(' ')} terminated by ${signal}.`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

for (const args of tasks) {
  const exitCode = await run(args);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    break;
  }
}
