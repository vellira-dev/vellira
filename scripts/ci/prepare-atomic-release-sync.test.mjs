import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED_PACKAGES, verifyPublishedRelease } from './prepare-atomic-release-sync.mjs';

test('verifies immutable GitHub release and all six exact npm packages', () => {
  process.env.EXPECTED_TAG_SHA = 'a'.repeat(40);
  const calls = [];
  const execute = (command, args) => {
    calls.push([command, ...args]);
    if (command === 'gh') return JSON.stringify(args[1].includes('/git/ref/tags/') ? { object: { type: 'commit', sha: 'a'.repeat(40) } } : { tag_name: 'v2.189.0', draft: false, prerelease: false });
    return JSON.stringify('2.189.0');
  };
  verifyPublishedRelease('2.189.0', { execute });
  assert.equal(calls.length, 8);
  assert.equal(calls.filter(x => x[0] === 'npm').length, PUBLISHED_PACKAGES.length);
  assert.ok(calls.every(x => !x.includes('publish')));
});

test('rejects draft, prerelease, wrong tag, or incomplete npm publication', () => {
  process.env.EXPECTED_TAG_SHA = 'a'.repeat(40);
  for (const release of [
    { tag_name: 'v2.188.12', draft: false, prerelease: false },
    { tag_name: 'v2.189.0', draft: true, prerelease: false },
    { tag_name: 'v2.189.0', draft: false, prerelease: true },
  ]) {
    assert.throws(() => verifyPublishedRelease('2.189.0', {
      execute: (command, args) => command === 'gh' ? JSON.stringify(args[1].includes('/git/ref/tags/') ? { object: { type: 'commit', sha: 'a'.repeat(40) } } : release) : JSON.stringify('2.189.0'),
    }));
  }
  assert.throws(() => verifyPublishedRelease('2.189.0', {
    execute: (command, args) => command === 'gh'
      ? JSON.stringify(args[1].includes('/git/ref/tags/') ? { object: { type: 'commit', sha: 'a'.repeat(40) } } : { tag_name: 'v2.189.0', draft: false, prerelease: false })
      : JSON.stringify(args[1].startsWith('@vellira-ui/react-native@') ? '2.188.12' : '2.189.0'),
  }), /Unpublished/);
});

test('rejects invalid version before any external request', () => {
  assert.throws(() => verifyPublishedRelease('2.189.0-beta.1', {
    execute: () => { throw Error('must not call'); },
  }), /Expected stable release version/);
});
