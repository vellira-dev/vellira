import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PRODUCTION_CONFIG = 'wrangler.production.jsonc';

function assertSha(value, label) {
  assert.match(
    value ?? '',
    SHA_PATTERN,
    label + ' must be an exact 40-character lowercase SHA'
  );
  return value;
}

export function productionFreshnessMode({ configPath, candidateSource }) {
  if (path.basename(configPath) !== PRODUCTION_CONFIG) {
    return 'not-production';
  }

  if (candidateSource === 'emergency-recovery') {
    return 'emergency-recovery';
  }

  assert.equal(
    candidateSource,
    'staging',
    'Production deployment requires a recognized candidate source'
  );
  return 'staging';
}

export function parseRemoteMainSha(output) {
  const parts = String(output ?? '').trim().split(/\s+/);
  const sha = parts[0];
  const ref = parts[1];
  const extra = parts.slice(2);

  assert.equal(ref, 'refs/heads/main', 'Remote main ref is missing');
  assert.equal(extra.length, 0, 'Remote main response is ambiguous');
  return assertSha(sha, 'Remote main SHA');
}

export function readRemoteMainSha({ cwd, spawnSyncImpl = spawnSync }) {
  const result = spawnSyncImpl(
    'git',
    ['ls-remote', 'origin', 'refs/heads/main'],
    { cwd, encoding: 'utf8' }
  );

  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Unable to resolve authoritative remote main');
  return parseRemoteMainSha(result.stdout);
}

export function assertFreshProductionCandidate({
  configPath,
  candidateSource,
  candidateSha,
  cwd,
  spawnSyncImpl = spawnSync,
}) {
  const mode = productionFreshnessMode({ configPath, candidateSource });

  if (mode !== 'staging') {
    return { checked: false, mode, mainSha: null };
  }

  assertSha(candidateSha, 'Production candidate SHA');
  const mainSha = readRemoteMainSha({ cwd, spawnSyncImpl });
  assert.equal(
    mainSha,
    candidateSha,
    'Production candidate ' + candidateSha + ' is stale; current main is ' + mainSha
  );

  return { checked: true, mode, mainSha };
}
