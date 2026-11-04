#!/usr/bin/env node
'use strict';
// Prove that the *real installed Expo executor* terminates a plugin child when
// our source-pinned output guard enforces its cumulative 128-item / 64 KiB limits.
const assert = require('node:assert/strict');
const path = require('node:path');
const {EventEmitter} = require('node:events');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules/expo/node_modules/@expo/cli');
const {DevToolsPluginCliExtensionExecutor: Executor} = require(
  path.join(cli, 'build/src/start/server/devtools/DevToolsPluginCliExtensionExecutor.js'));
assert.equal(typeof Executor, 'function', 'Expected published Expo CLI 58.1.19 executor');

const plugin = {
  packageName: 'vellira-executor-security-proof',
  packageRoot: root,
  cliExtensions: {
    entryPoint: 'index.ts',
    commands: [{name: 'probe', title: 'Probe', environments: ['cli'], parameters: []}],
  },
};

async function runCase(chunks, {truncated, expectedItems, expectedCallbacks}) {
  const killed = [];
  const callbacks = [];
  let spawnCount = 0;
  const spawn = (bin, args, options) => {
    spawnCount++;
    assert.equal(bin, process.execPath, 'Executor must not run a PATH-selected node');
    assert.equal(options.cwd, root);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => { killed.push(signal); return true; };
    queueMicrotask(() => {
      for (const chunk of chunks) {
        if (killed.length) break;
        child[chunk.stream || 'stdout'].emit('data', Buffer.from(chunk.text, 'utf8'));
      }
      child.emit('close', 0);
    });
    return child;
  };
  const executor = new Executor(plugin, root, spawn, 1000);
  const result = await executor.execute({
    command: 'probe',
    args: {},
    metroServerOrigin: 'http://127.0.0.1:8081',
    onOutput: (items) => callbacks.push(...items),
  });
  assert.equal(spawnCount, 1);
  assert.equal(result.length, expectedItems, 'Wrong bounded output count');
  assert.equal(callbacks.length, expectedCallbacks, 'Wrong callback item count');
  assert.ok(result.length <= 128, 'Executor exceeded 128 total items');
  assert.ok(callbacks.length <= 128, 'Callback exceeded 128 total items');
  assert.deepEqual(killed, truncated ? ['SIGKILL'] : [],
    'Child process must be killed once and only when collector truncates');
  return result;
}

(async () => {
  const item = {type: 'text', text: 'x', level: 'info'};
  const group128 = JSON.stringify(Array.from({length: 128}, () => item));
  assert.ok(Buffer.byteLength(group128, 'utf8') * 2 < 65536);
  await runCase([
    {stream: 'stdout', text: group128},
    {stream: 'stderr', text: group128},
  ], {truncated: true, expectedItems: 128, expectedCallbacks: 128});
  const text = await runCase(
    [{stream: 'stdout', text: 'x\n'.repeat(30000)}],
    {truncated: true, expectedItems: 1, expectedCallbacks: 1});
  assert.equal(text[0].text, 'Too many output items');
  const mixed = await runCase([
    {stream: 'stdout', text: 'ok\n'.repeat(100)},
    {stream: 'stderr', text: 'err\n'.repeat(29)},
  ], {truncated: true, expectedItems: 101, expectedCallbacks: 101});
  assert.equal(mixed.at(-1).text, 'Too many output items');
  await runCase([{stream: 'stdout', text: JSON.stringify([item])}],
    {truncated: false, expectedItems: 1, expectedCallbacks: 1});
  console.log(JSON.stringify({
    status: 'PASS',
    tested: [
      'real-expo-executor',
      'mixed-stdout-stderr-global-item-budget',
      'large-plain-text-fanout',
      'callback-output-consistency',
      'single-SIGKILL-on-truncation',
      'normal-command-exit',
    ],
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
