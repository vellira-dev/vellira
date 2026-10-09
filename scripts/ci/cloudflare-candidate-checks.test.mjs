import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cloudflareCandidateCommand } from './cloudflare-candidate-checks.mjs';

const directory = 'apps/react-storybook/scripts';
const baseline = [
  'cloudflare-browser-diagnostics.mjs',
  'cloudflare-browser-diagnostics.test.mjs',
  'cloudflare-blog-metrics-smoke-policy.mjs',
  'cloudflare-blog-metrics-smoke-policy.test.mjs',
  'cloudflare-navigation-soak.mjs',
  'cloudflare-website-smoke.mjs',
];
function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-cloudflare-source-')
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name) => {
    const p = path.join(root, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'export {};\n');
  };
  for (const name of [
    ...baseline.map((n) => `${directory}/${n}`),
    'apps/website/cloudflare-worker.mjs',
    'apps/website/cloudflare/cache.mjs',
    'apps/website/scripts/runtime.mjs',
  ])
    write(name);
  return { root, write };
}

test('historical source runs all original checks without requiring later recovery modules', (t) => {
  const { root } = fixture(t);
  assert.deepEqual(cloudflareCandidateCommand(root, 'test'), [
    process.execPath,
    '--test',
    `${directory}/cloudflare-blog-metrics-smoke-policy.test.mjs`,
  ]);
  const command = cloudflareCandidateCommand(root, 'lint');
  assert.deepEqual(command.slice(0, 3), ['pnpm', 'exec', 'eslint']);
  for (const name of baseline)
    assert.ok(command.includes(`${directory}/${name}`));
  assert.ok(command.includes('apps/website/cloudflare-worker.mjs'));
  assert.ok(command.includes('apps/website/cloudflare/cache.mjs'));
  assert.ok(command.includes('apps/website/scripts/runtime.mjs'));
});

test('every recovery module present has its test linted and executed', (t) => {
  const { root, write } = fixture(t);
  for (const name of ['edge', 'client-navigation', 'future']) {
    write(`${directory}/cloudflare-${name}-recovery.mjs`);
    write(`${directory}/cloudflare-${name}-recovery.test.mjs`);
  }
  const tests = cloudflareCandidateCommand(root, 'test');
  const lint = cloudflareCandidateCommand(root, 'lint');
  assert.equal(tests.length, 6);
  for (const name of ['edge', 'client-navigation', 'future']) {
    assert.ok(
      tests.includes(`${directory}/cloudflare-${name}-recovery.test.mjs`)
    );
    assert.ok(lint.includes(`${directory}/cloudflare-${name}-recovery.mjs`));
    assert.ok(
      lint.includes(`${directory}/cloudflare-${name}-recovery.test.mjs`)
    );
  }
});

for (const suffix of ['.mjs', '.test.mjs'])
  test(`missing recovery pair fails rather than silently omitting it: ${suffix}`, (t) => {
    const { root, write } = fixture(t);
    write(`${directory}/cloudflare-edge-recovery${suffix}`);
    assert.throws(() => cloudflareCandidateCommand(root, 'test'), /missing/);
    assert.throws(() => cloudflareCandidateCommand(root, 'lint'), /missing/);
  });

test('missing baseline and empty lint families fail closed', (t) => {
  const { root } = fixture(t);
  fs.unlinkSync(path.join(root, 'apps/website/cloudflare/cache.mjs'));
  assert.throws(() => cloudflareCandidateCommand(root, 'lint'), /empty/);
  fs.unlinkSync(
    path.join(
      root,
      `${directory}/cloudflare-blog-metrics-smoke-policy.test.mjs`
    )
  );
  assert.throws(() => cloudflareCandidateCommand(root, 'test'), /missing/);
});

test('only fixed lint and test profiles are accepted', (t) => {
  assert.throws(
    () => cloudflareCandidateCommand(fixture(t).root, 'skip'),
    /Unknown/
  );
});
