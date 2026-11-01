import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  ATOMIC_RELEASE_SYNC_PATHS,
  verifyAtomicReleaseContents,
} from './atomic-release-sync.mjs';

const SHA = /^[0-9a-f]{40}$/;

export function loadAtomicSnapshot(ref, { readFile } = {}) {
  assert.match(ref, SHA, 'Snapshot ref must be an exact immutable SHA');
  const read = readFile ?? ((sha, filename) =>
    execFileSync('git', ['show', sha + ':' + filename], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  return Object.fromEntries(ATOMIC_RELEASE_SYNC_PATHS.map((filename) => {
    const raw = read(ref, filename);
    return [filename, filename.endsWith('.json') ? JSON.parse(raw) : raw];
  }));
}

export function verifyAtomicCandidate({
  baseSha, headSha, files, version, readFile,
}) {
  assert.match(baseSha, SHA, 'Atomic sync base must be immutable');
  assert.match(headSha, SHA, 'Atomic sync head must be immutable');
  assert.notEqual(baseSha, headSha, 'Atomic sync must change the candidate');
  const before = loadAtomicSnapshot(baseSha, { readFile });
  const after = loadAtomicSnapshot(headSha, { readFile });
  return verifyAtomicReleaseContents({ files, before, after, version });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [baseSha, headSha, version] = process.argv.slice(2);
  assert.ok(baseSha && headSha && version,
    'Usage: node scripts/ci/verify-atomic-release-sync.mjs <base-sha> <head-sha> <version>');
  const files = execFileSync('git', ['diff', '--name-only', baseSha, headSha], {
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);
  console.log(JSON.stringify(verifyAtomicCandidate({ baseSha, headSha, files, version })));
}
