import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  inspectRuntimeCandidate,
  RUNTIME_CANDIDATE_AUTHOR,
  RUNTIME_CANDIDATE_INTENT,
  RUNTIME_CANDIDATE_MESSAGE,
  RUNTIME_CANDIDATE_TITLE,
  runtimeCandidateBranch,
  runtimeCandidateMarker,
} from './dependabot-runtime-candidate-authority.mjs';

const repository = 'vellira-dev/vellira';
const sourceSha = 'a'.repeat(40);
const candidateSha = 'b'.repeat(40);
const treeSha = 'c'.repeat(40);
const branch = runtimeCandidateBranch(sourceSha);

const refs = [
  {
    ref: 'refs/heads/' + branch,
    object: { type: 'commit', sha: candidateSha },
  },
];
const commit = {
  sha: candidateSha,
  parents: [{ sha: sourceSha }],
  commit: { message: RUNTIME_CANDIDATE_MESSAGE, tree: { sha: treeSha } },
  files: [
    { filename: 'pnpm-lock.yaml' },
    { filename: 'pnpm-workspace.yaml' },
  ],
};
const body = [
  RUNTIME_CANDIDATE_INTENT,
  runtimeCandidateMarker(sourceSha, candidateSha),
  'Draft runtime patch candidate',
].join('\n');
const legitimatePull = {
  number: 999,
  state: 'open',
  draft: true,
  title: RUNTIME_CANDIDATE_TITLE,
  body,
  user: { login: RUNTIME_CANDIDATE_AUTHOR },
  base: { ref: 'main', repo: { full_name: repository } },
  head: {
    ref: branch,
    sha: candidateSha,
    repo: { full_name: repository },
  },
};
const inspect = (changes = {}) =>
  inspectRuntimeCandidate({
    refs,
    pulls: [],
    commit,
    repository,
    sourceSha,
    ...changes,
  });

test('only an authenticated App PR for the exact same-repo branch suppresses duplicate work', () => {
  const out = inspect({ pulls: [legitimatePull] });
  assert.deepEqual(out.authenticatedPR, { number: 999, draft: true });
  assert.equal(out.orphanedBranch, false);
  // Owner may mark the PR Ready. Never automatically reset their decision.
  assert.deepEqual(
    inspect({ pulls: [{ ...legitimatePull, draft: false }] }).authenticatedPR,
    { number: 999, draft: false }
  );
});

test('spoofed title from a fork cannot suppress work on an orphaned branch', () => {
  const attacker = {
    ...legitimatePull,
    number: 42,
    user: { login: 'outsider' },
    head: {
      ...legitimatePull.head,
      repo: { full_name: 'outsider/fork' },
    },
  };
  const result = inspect({ pulls: [attacker] });
  assert.equal(result.authenticatedPR, null);
  assert.equal(result.orphanedBranch, true);
});

test('same-title PR on a different same-repository branch does not suppress work', () => {
  const attacker = {
    ...legitimatePull,
    number: 43,
    user: { login: 'other-author' },
    head: { ...legitimatePull.head, ref: 'unrelated-branch' },
  };
  assert.equal(inspect({ pulls: [attacker] }).authenticatedPR, null);
});

test('no ref and only a spoofed title correctly allows candidate creation', () => {
  const attacker = {
    ...legitimatePull,
    number: 44,
    head: {
      ...legitimatePull.head,
      repo: { full_name: 'outside/fork' },
    },
  };
  const result = inspect({ refs: [], commit: null, pulls: [attacker] });
  assert.equal(result.branchSha, null);
  assert.equal(result.authenticatedPR, null);
});

test('orphaned candidate branch is recoverable after a PR API failure', () => {
  const out = inspect({ expectedTree: treeSha });
  assert.equal(out.branchSha, candidateSha);
  assert.equal(out.authenticatedPR, null);
  assert.equal(out.orphanedBranch, true);
});

test('different regenerated tree fails closed instead of silently skipping retries', () => {
  assert.throws(
    () => inspect({ expectedTree: 'd'.repeat(40) }),
    /Existing candidate branch differs/
  );
});

test('foreign parent or unauthorized changed file fails closed', () => {
  assert.throws(
    () => inspect({ commit: { ...commit, parents: [{ sha: 'd'.repeat(40) }] } }),
    /direct child/
  );
  assert.throws(
    () =>
      inspect({
        commit: {
          ...commit,
          files: [...commit.files, { filename: '.github/workflows/ci.yml' }],
        },
      }),
    /authorized dependency files/
  );
});

test('same-repo canonical branch with untrusted author or SHA fails visibly', () => {
  assert.throws(
    () =>
      inspect({
        pulls: [{ ...legitimatePull, user: { login: 'malicious-user' } }],
      }),
    /trusted GitHub App/
  );
  assert.throws(
    () =>
      inspect({
        pulls: [{
          ...legitimatePull,
          head: { ...legitimatePull.head, sha: 'd'.repeat(40) },
        }],
      }),
    /authenticated candidate branch/
  );
});

test('missing or duplicated source markers cannot claim an authentic PR', () => {
  assert.throws(
    () =>
      inspect({
        pulls: [{ ...legitimatePull, body: RUNTIME_CANDIDATE_INTENT }],
      }),
    /provenance mismatch/
  );
  assert.throws(
    () =>
      inspect({
        pulls: [{ ...legitimatePull, body: body + '\n' + body }],
      }),
    /provenance mismatch/
  );
});

test('ambiguous canonical PRs or PR without branch cannot suppress work', () => {
  assert.throws(
    () => inspect({
      pulls: [legitimatePull, { ...legitimatePull, number: 1001 }],
    }),
    /Ambiguous canonical/
  );
  assert.throws(
    () => inspect({ refs: [], commit: null, pulls: [legitimatePull] }),
    /no matching branch/
  );
});

test('runtime workflow must re-read canonical branch and recover orphaned commits', () => {
  const workflow = readFileSync(
    '.github/workflows/dependabot-runtime-candidates.yml',
    'utf8'
  );
  assert.ok(
    workflow.includes('git/matching-refs/heads/' + '$' + '{branch}'),
    'Workflow must use exact canonical matching refs'
  );
  assert.match(workflow, /dependabot-runtime-candidate-authority\.mjs/);
  assert.match(workflow, /vellira-runtime-security-candidate:v1/);
  assert.match(workflow, /Existing candidate branch is verified and recoverable/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /--draft/);
});
