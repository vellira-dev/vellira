import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolingRoot = fileURLToPath(new URL('../../', import.meta.url));
const dependencies = JSON.parse(
  readFileSync(
    new URL('./tooling-build-dependencies.json', import.meta.url),
    'utf8'
  )
);

// Self-tests execute validator authority; source/runtime tests execute candidate
// authority. Neither may implicitly install dependencies during validation.
export function createToolingTasks({
  candidateRoot,
  profile,
  environment = process.env,
}) {
  if (
    profile !== undefined &&
    !['--source-contracts', '--harness-contracts'].includes(profile)
  ) {
    throw new Error('Unknown tooling execution profile.');
  }
  const splitProductionFixtures = environment.GITHUB_ACTIONS === 'true';
  const harness = [
    'scripts/ci/tooling-execution.test.mjs',
    'scripts/ci/run-candidate-quality.test.mjs',
    'scripts/ci/cloudflare-candidate-checks.test.mjs',
    'scripts/visual/canonical-fonts.test.mjs',
    'scripts/ci/workflow-noise.test.mjs',
    'scripts/ci/pr-change-intent.test.mjs',
    'scripts/smoke/utils.test.mjs',
    'scripts/ci/dependabot-security-remediation.test.mjs',
    'scripts/ci/dependabot-verified-backports.test.mjs',
    'scripts/ci/chromatic-impact.test.mjs',
  ].map((file) => ({
    name: file,
    authority: 'harness',
    cwd: toolingRoot,
    args: ['--test', path.join(toolingRoot, file)],
  }));
  const vitest = path.join(candidateRoot, 'node_modules/vitest/vitest.mjs');
  const common = [vitest, 'run', '--config', 'vitest.tooling.config.ts'];
  const baseArgs = [
    ...common,
    '--exclude',
    'scripts/checks/token-semantic/cli.test.ts',
  ];
  if (profile === '--source-contracts') {
    // Protected private runners have less memory than public repository CI.
    // Bound nested TypeScript fixture compilers to one source-test worker.
    baseArgs.push('--reporter=default', '--maxWorkers=1');
    for (const group of dependencies) {
      for (const file of group.files) baseArgs.push('--exclude', file);
    }
  }
  if (splitProductionFixtures || profile === '--source-contracts') {
    baseArgs.push(
      '--exclude',
      'scripts/component-production/e2e-fixtures.test.ts'
    );
  }
  const source = {
    name: 'tooling suite',
    authority: 'candidate',
    cwd: candidateRoot,
    args: baseArgs,
  };
  if (profile === '--source-contracts') return [source];
  if (profile === '--harness-contracts') return harness;
  return [
    ...harness,
    source,
    {
      name: 'token semantic CLI integration',
      authority: 'candidate',
      cwd: candidateRoot,
      args: [...common, 'scripts/checks/token-semantic/cli.test.ts'],
    },
  ];
}

export async function runToolingTasks(
  tasks,
  {
    spawnCommand = spawn,
    signals = process,
    killTree = (child) =>
      process.platform === 'win32'
        ? child.kill('SIGKILL')
        : process.kill(-child.pid, 'SIGKILL'),
    log = console.log,
  } = {}
) {
  let exitCode = 0;
  let cancelled = false;
  let active;
  const cancel = () => {
    cancelled = true;
    if (active) {
      try {
        killTree(active);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  };
  signals.once('SIGTERM', cancel);
  signals.once('SIGINT', cancel);
  try {
    for (const task of tasks) {
      if (cancelled) break;
      log(
        `[tooling] start ${task.name}; authority=${task.authority}; root=${task.cwd}`
      );
      const code = await new Promise((resolve) => {
        active = spawnCommand(process.execPath, task.args, {
          cwd: task.cwd,
          stdio: 'inherit',
          detached: process.platform !== 'win32',
          // Isolated fixtures deliberately reuse the frozen installed graph.
          // Nested pnpm commands must not purge/reinstall its shared modules.
          env: {
            ...process.env,
            PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
            pnpm_config_verify_deps_before_run: 'false',
          },
        });
        active.once('error', (error) => {
          log(`[tooling] ${task.name} failed to start: ${error.message}`);
          resolve(1);
        });
        active.once('exit', (code, signal) => {
          log(
            `[tooling] finish ${task.name}; exit=${code}; signal=${signal ?? 'none'}`
          );
          resolve(code ?? 1);
        });
      });
      active = undefined;
      if (code !== 0) exitCode = code;
    }
  } finally {
    signals.removeListener('SIGTERM', cancel);
    signals.removeListener('SIGINT', cancel);
  }
  return cancelled ? 1 : exitCode;
}
