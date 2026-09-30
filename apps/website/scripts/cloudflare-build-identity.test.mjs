import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';

const sourceFile = new URL(
  '../cloudflare/build-identity.mjs',
  import.meta.url
);
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !key.startsWith('GITHUB_') &&
      !key.startsWith('GIT_') &&
      !key.startsWith('CANDIDATE_') &&
      !key.startsWith('VELLIRA_')
  )
);
let temporary;
let checkout;
let moduleFile;
let candidateSha;
let controlSha;
let fromCheckout;

function git(...args) {
  return execFileSync('git', args, {
    cwd: checkout,
    encoding: 'utf8',
    env: cleanEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

before(async () => {
  temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-build-identity-')
  );
  checkout = path.join(temporary, 'checkout');
  moduleFile = path.join(
    checkout,
    'apps/website/cloudflare/build-identity.mjs'
  );
  await fs.mkdir(path.dirname(moduleFile), { recursive: true });
  await fs.copyFile(sourceFile, moduleFile);
  git('init', '--quiet');
  git('config', 'user.name', 'Identity Test');
  git('config', 'user.email', 'identity-test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', path.join(temporary, 'no-hooks'));
  git('add', '.');
  git('commit', '--quiet', '-m', 'candidate');
  candidateSha = git('rev-parse', 'HEAD');
  git(
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'control branch advanced'
  );
  controlSha = git('rev-parse', 'HEAD');
  assert.notEqual(candidateSha, controlSha);
  git('checkout', '--quiet', '--detach', candidateSha);
  ({ deploymentIdentity: fromCheckout } = await import(
    pathToFileURL(moduleFile).href
  ));
});

after(async () => {
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
});

function promoted(overrides = {}) {
  return {
    VELLIRA_DEPLOYABLE: '1',
    VELLIRA_BUILD_ID: `${candidateSha}-123-2`,
    CANDIDATE_SHA: candidateSha,
    CANDIDATE_SOURCE: 'staging',
    GITHUB_EVENT_NAME: 'workflow_run',
    GITHUB_SHA: controlSha,
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
    ...overrides,
  };
}

function child(env, cwd = temporary, extra = {}) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
      import { deploymentIdentity } from ${JSON.stringify(pathToFileURL(moduleFile).href)};
      const identity = deploymentIdentity();
      if (process.env.GITHUB_SHA !== ${JSON.stringify(env.GITHUB_SHA)})
        throw new Error('Control SHA was overwritten');
      console.log(identity);
    `,
    ],
    { cwd, env: { ...cleanEnv, ...env, ...extra }, encoding: 'utf8' }
  );
}

test('workflow_run builds the exact staged checkout, not the newer control SHA', () => {
  const env = promoted();
  assert.equal(fromCheckout(env), env.VELLIRA_BUILD_ID);
  assert.equal(
    fromCheckout(promoted({ GITHUB_SHA: candidateSha })),
    env.VELLIRA_BUILD_ID
  );
  assert.equal(env.GITHUB_SHA, controlSha);
});

test('emergency dispatch binds the explicit candidate to checkout without changing the control SHA', () => {
  const env = promoted({
    CANDIDATE_SOURCE: 'emergency-recovery',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
  });
  assert.equal(fromCheckout(env), env.VELLIRA_BUILD_ID);
  const result = child(env, path.join(checkout, 'apps/website'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), env.VELLIRA_BUILD_ID);
});

test('the same guard works from repo root, website cwd and an unrelated directory', () => {
  const env = promoted();
  for (const cwd of [
    checkout,
    path.join(checkout, 'apps/website'),
    temporary,
  ]) {
    const result = child(env, cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), env.VELLIRA_BUILD_ID);
  }
});

test('missing, partial or mismatched production source/event metadata fails closed', () => {
  for (const overrides of [
    { CANDIDATE_SOURCE: undefined },
    { CANDIDATE_SOURCE: '' },
    { CANDIDATE_SOURCE: 'unknown' },
    { GITHUB_EVENT_NAME: undefined },
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { CANDIDATE_SOURCE: 'emergency-recovery' },
  ]) {
    assert.throws(
      () => fromCheckout(promoted(overrides)),
      /candidate source and event/
    );
  }
  assert.throws(
    () =>
      fromCheckout(
        promoted({
          CANDIDATE_SOURCE: undefined,
          CANDIDATE_SHA: undefined,
          GITHUB_SHA: candidateSha,
        })
      ),
    /candidate source and event/
  );
});

test('candidate refs, abbreviations, empty values and malformed SHAs are rejected', () => {
  for (const sha of [
    undefined,
    '',
    'main',
    candidateSha.slice(0, 12),
    'A'.repeat(40),
    'g'.repeat(40),
    `${candidateSha}\n`,
  ]) {
    assert.throws(
      () => fromCheckout(promoted({ CANDIDATE_SHA: sha })),
      /exact CANDIDATE_SHA/
    );
  }
});

test('matching build ID and candidate metadata cannot label a different checkout', () => {
  assert.throws(
    () =>
      fromCheckout(
        promoted({
          CANDIDATE_SHA: controlSha,
          VELLIRA_BUILD_ID: `${controlSha}-123-2`,
        })
      ),
    /checked-out HEAD/
  );
});

test('the build ID cannot use the control SHA instead of the selected candidate', () => {
  assert.throws(
    () =>
      fromCheckout(promoted({ VELLIRA_BUILD_ID: `${controlSha}-123-2` })),
    /does not match CANDIDATE_SHA/
  );
});

test('checkout identity is rechecked, not cached across preparation and verification', () => {
  assert.equal(fromCheckout(promoted()), promoted().VELLIRA_BUILD_ID);
  try {
    git('checkout', '--quiet', '--detach', controlSha);
    assert.throws(() => fromCheckout(promoted()), /checked-out HEAD/);
  } finally {
    git('checkout', '--quiet', '--detach', candidateSha);
  }
});

test('GIT_DIR redirection cannot replace the source checkout authority', () => {
  const result = child(promoted(), temporary, {
    GIT_DIR: path.join(temporary, 'nonexistent.git'),
    GIT_WORK_TREE: temporary,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), promoted().VELLIRA_BUILD_ID);
});

test('unverifiable production checkout fails rather than falling back to GITHUB_SHA', async () => {
  const gitPath = path.join(checkout, '.git');
  const hiddenPath = path.join(temporary, 'hidden-git');
  await fs.rename(gitPath, hiddenPath);
  try {
    assert.throws(() =>
      fromCheckout(promoted({ GITHUB_SHA: candidateSha }))
    );
  } finally {
    await fs.rename(hiddenPath, gitPath);
  }
});

test('production run and attempt bindings remain mandatory and exact', () => {
  for (const overrides of [
    { GITHUB_RUN_ID: undefined },
    { GITHUB_RUN_ATTEMPT: '' },
    { GITHUB_RUN_ID: '124' },
    { GITHUB_RUN_ATTEMPT: '3' },
  ]) {
    assert.throws(
      () => fromCheckout(promoted(overrides)),
      /GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT/
    );
  }
});

test('direct staging push, manual staging and PR checks preserve GITHUB_SHA matching', () => {
  const direct = promoted({
    CANDIDATE_SOURCE: undefined,
    GITHUB_SHA: candidateSha,
  });
  for (const event of [
    'push',
    'workflow_dispatch',
    'pull_request',
    undefined,
  ]) {
    const env = { ...direct, GITHUB_EVENT_NAME: event };
    assert.equal(fromCheckout(env), env.VELLIRA_BUILD_ID);
    assert.throws(
      () => fromCheckout({ ...env, GITHUB_SHA: controlSha }),
      /GITHUB_SHA/
    );
  }
});

test('existing build ID format, run/attempt checks and local behavior are preserved', () => {
  const id = `${'a'.repeat(40)}-123-1`;
  assert.equal(
    deploymentIdentity({ VELLIRA_DEPLOYABLE: '1', VELLIRA_BUILD_ID: id }),
    id
  );
  for (const invalid of [
    undefined,
    '',
    'local-123',
    'a'.repeat(40),
    `${'a'.repeat(40)}-x-1`,
  ]) {
    assert.throws(
      () =>
        deploymentIdentity({
          VELLIRA_DEPLOYABLE: '1',
          VELLIRA_BUILD_ID: invalid,
        }),
      /Deployable builds require/
    );
  }
  for (const [key, value] of [
    ['GITHUB_SHA', 'b'.repeat(40)],
    ['GITHUB_RUN_ID', '124'],
    ['GITHUB_RUN_ATTEMPT', '2'],
  ]) {
    assert.throws(
      () =>
        deploymentIdentity({
          VELLIRA_DEPLOYABLE: '1',
          VELLIRA_BUILD_ID: id,
          [key]: value,
        }),
      new RegExp(key)
    );
  }
  assert.equal(
    deploymentIdentity({ VELLIRA_BUILD_ID: ' local-fixture ' }),
    'local-fixture'
  );
  assert.notEqual(deploymentIdentity({}), deploymentIdentity({}));
});
