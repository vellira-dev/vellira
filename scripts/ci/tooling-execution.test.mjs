import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createToolingTasks, runToolingTasks } from './tooling-execution.mjs';

const authority = fileURLToPath(new URL('../../', import.meta.url));
const candidateRoot = path.resolve(
  '/synthetic-candidate-predating-new-validator-tests'
);

test('validator self-tests use validator authority even when the candidate predates them', () => {
  const tasks = createToolingTasks({
    candidateRoot,
    profile: '--harness-contracts',
  });
  assert.ok(tasks.length >= 6);
  for (const task of tasks) {
    assert.equal(task.cwd, authority);
    assert.equal(task.authority, 'harness');
    assert.equal(task.args[0], '--test');
    assert.ok(fs.existsSync(task.args[1]));
  }
});

test('production source profile is candidate-rooted and delegates only explicit companion groups', () => {
  for (const environment of [{}, { GITHUB_ACTIONS: 'true' }]) {
    const tasks = createToolingTasks({
      candidateRoot,
      profile: '--source-contracts',
      environment,
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].cwd, candidateRoot);
    assert.equal(
      tasks[0].args[0],
      path.join(candidateRoot, 'node_modules/vitest/vitest.mjs')
    );
    assert.ok(tasks[0].args.includes('--reporter=default'));
    assert.ok(tasks[0].args.includes('--maxWorkers=1'));
    for (const file of [
      'scripts/component-production/e2e-fixtures.test.ts',
      'scripts/checks/token-semantic/cli.test.ts',
      'scripts/checks/vellira-ui-usage/developer-panel.test.tsx',
      'scripts/checks/workspace-source-resolution/workspace-source-resolution.test.ts',
    ]) {
      assert.equal(tasks[0].args[tasks[0].args.indexOf(file) - 1], '--exclude');
    }
  }
});

test('independent tasks run after failure using Node directly, without package-manager side effects', async () => {
  const tasks = createToolingTasks({
    candidateRoot,
    profile: '--harness-contracts',
  });
  const calls = [];
  const output = [];
  const code = await runToolingTasks(tasks, {
    spawnCommand(executable, args, options) {
      calls.push({ executable, args, options });
      const child = new EventEmitter();
      process.nextTick(() =>
        child.emit('exit', calls.length === 1 ? 1 : 0, null)
      );
      return child;
    },
    signals: new EventEmitter(),
    log: (line) => output.push(line),
  });
  assert.equal(code, 1);
  assert.equal(calls.length, tasks.length);
  for (const call of calls) {
    assert.equal(call.executable, process.execPath);
    assert.equal(call.options.env.PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN, 'false');
    assert.equal(call.options.env.pnpm_config_verify_deps_before_run, 'false');
  }
  assert.equal(
    output.filter((line) => line.includes('[tooling] finish')).length,
    tasks.length
  );
});

test('timeout/cancellation kills the active process tree and cannot start another task', async () => {
  const signals = new EventEmitter();
  const calls = [];
  const killed = [];
  const code = await runToolingTasks(createToolingTasks({ candidateRoot }), {
    signals,
    log: () => {},
    spawnCommand(_executable, _args, options) {
      const child = new EventEmitter();
      calls.push(options);
      process.nextTick(() => signals.emit('SIGTERM'));
      return child;
    },
    killTree(child) {
      killed.push(child);
      process.nextTick(() => child.emit('exit', null, 'SIGKILL'));
    },
  });
  assert.equal(code, 1);
  assert.equal(calls.length, 1);
  assert.equal(killed.length, 1);
  assert.equal(calls[0].detached, process.platform !== 'win32');
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('unknown profiles cannot silently select a partial check set', () => {
  assert.throws(
    () => createToolingTasks({ candidateRoot, profile: '--unknown' }),
    /Unknown tooling/
  );
});
