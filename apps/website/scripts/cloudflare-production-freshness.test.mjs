import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  assertFreshProductionCandidate,
  parseRemoteMainSha,
  productionFreshnessMode,
} from './cloudflare-production-freshness.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function gitMain(sha) {
  return {
    status: 0,
    stdout: sha + '\trefs/heads/main\n',
    stderr: '',
  };
}

test('production staging freshness rejects main advancing after script entry', () => {
  const responses = [gitMain(A), gitMain(B)];
  const spawnSyncImpl = () => responses.shift();

  assert.deepEqual(
    assertFreshProductionCandidate({
      configPath: '/repo/apps/website/wrangler.production.jsonc',
      candidateSource: 'staging',
      candidateSha: A,
      cwd: '/repo/apps/website',
      spawnSyncImpl,
    }),
    { checked: true, mode: 'staging', mainSha: A }
  );

  assert.throws(
    () =>
      assertFreshProductionCandidate({
        configPath: '/repo/apps/website/wrangler.production.jsonc',
        candidateSource: 'staging',
        candidateSha: A,
        cwd: '/repo/apps/website',
        spawnSyncImpl,
      }),
    /is stale; current main is/
  );
});

test('emergency production recovery is an explicit freshness bypass', () => {
  let calls = 0;
  assert.deepEqual(
    assertFreshProductionCandidate({
      configPath: '/repo/apps/website/wrangler.production.jsonc',
      candidateSource: 'emergency-recovery',
      candidateSha: A,
      cwd: '/repo/apps/website',
      spawnSyncImpl: () => {
        calls += 1;
        return gitMain(B);
      },
    }),
    { checked: false, mode: 'emergency-recovery', mainSha: null }
  );
  assert.equal(calls, 0);
});

test('staging target does not require production freshness', () => {
  assert.equal(
    productionFreshnessMode({
      configPath: '/repo/apps/website/wrangler.jsonc',
      candidateSource: undefined,
    }),
    'not-production'
  );
});

test('unknown production candidate source fails closed', () => {
  assert.throws(
    () =>
      productionFreshnessMode({
        configPath: '/repo/apps/website/wrangler.production.jsonc',
        candidateSource: undefined,
      }),
    /recognized candidate source/
  );
});

test('remote main parser rejects malformed or ambiguous authority', () => {
  assert.equal(parseRemoteMainSha(A + '\trefs/heads/main\n'), A);
  assert.throws(() => parseRemoteMainSha(''), /Remote main ref is missing/);
  assert.throws(
    () =>
      parseRemoteMainSha(
        A + '\trefs/heads/main\n' + B + '\trefs/heads/main\n'
      ),
    /ambiguous/
  );
});

test('deploy script gates archive mutation and real activation with freshness', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, 'cloudflare-deploy.mjs'),
    'utf8'
  );

  const marker = 'assertFreshProductionCandidate(freshnessContext);';
  const firstCheck = source.indexOf(marker);
  const secondCheck = source.indexOf(marker, firstCheck + marker.length);
  const thirdCheck = source.indexOf(marker, secondCheck + marker.length);
  const archive = source.indexOf('await withRemoteArchive(');
  const dryRun = source.indexOf("'--dry-run'");
  const activation = source.indexOf(
    "run('pnpm', ['exec', 'wrangler', 'deploy'",
    dryRun
  );

  assert.ok(firstCheck >= 0);
  assert.ok(secondCheck > firstCheck);
  assert.equal(thirdCheck, -1);
  assert.ok(firstCheck < archive, 'Freshness must gate remote archive mutation');
  assert.ok(dryRun < secondCheck, 'Final freshness must run after dry-run');
  assert.ok(
    secondCheck < activation,
    'Final freshness must run immediately before production activation'
  );

  const between = source.slice(secondCheck + marker.length, activation);
  assert.doesNotMatch(
    between,
    /await |fetch\(|withRemoteArchive|prepareDeployment|populateCache/,
    'No async or remote mutation may occur after final freshness check'
  );
});
