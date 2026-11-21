import assert from 'node:assert/strict';

import {
  isReleaseSyncFileSet,
  isAtomicReleaseSyncCandidate,
} from '../../../scripts/ci/release-sync-contract.mjs';
import {
  assessFreshProductionCandidate,
  changedPathsFromCompare,
} from './cloudflare-production-freshness.mjs';

const OWNER = 'vellira-dev/vellira';
const SHA = /^[0-9a-f]{40}$/;

// Deliberately narrower than generic production equivalence: only an
// authenticated release-sync transition may bridge an earlier staging SHA.
export async function verifyStagingReleaseSyncAdvance({
  candidateSha,
  mainSha,
  githubGet,
  assess = assessFreshProductionCandidate,
}) {
  assert.match(candidateSha ?? '', SHA);
  assert.match(mainSha ?? '', SHA);
  assert.notEqual(candidateSha, mainSha, 'Release-sync advance must move main');
  assert.equal(typeof githubGet, 'function');
  assert.equal(typeof assess, 'function');

  const comparison = await githubGet(
    '/repos/' + OWNER + '/compare/' + candidateSha + '...' + mainSha
  );
  const paths = changedPathsFromCompare(comparison);
  assert.ok(
    isReleaseSyncFileSet(paths) || isAtomicReleaseSyncCandidate(paths),
    'Staging verification permits only exact release-sync paths'
  );
  // The existing production gate authenticates release-sync commit ancestry,
  // app identity, and immutable before/after manifest and lockfile contents.
  const evidence = await assess({
    configPath: 'apps/website/wrangler.production.jsonc',
    candidateSource: 'staging',
    candidateSha,
    mainSha,
    repository: OWNER,
    githubToken: process.env.GITHUB_TOKEN,
  });
  assert.equal(evidence?.checked, true, 'Release-sync evidence missing');
  assert.equal(evidence.mode, 'staging', 'Unexpected release-sync proof mode');
  assert.equal(evidence.mainSha, mainSha, 'Release-sync proof main mismatch');
  assert.equal(evidence.deploymentEquivalent, true, 'Unproven deployment equivalence');
  assert.deepEqual(evidence.relevantPaths, [], 'Deployment-relevant files changed');
  assert.deepEqual(
    [...evidence.changedPaths].sort(),
    [...paths].sort(),
    'Release-sync proof changed paths mismatch'
  );
  return { mainSha, changedPaths: paths };
}
