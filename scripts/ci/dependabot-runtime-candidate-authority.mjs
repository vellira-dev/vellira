import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNTIME_CANDIDATE_TITLE =
  'chore(security): propose bounded runtime fixes';
export const RUNTIME_CANDIDATE_MESSAGE =
  'chore(security): propose bounded runtime patches';
export const RUNTIME_CANDIDATE_AUTHOR = 'vellira-release-sync[bot]';
export const RUNTIME_CANDIDATE_INTENT =
  '<!-- vellira-change-intent:v1:bounded-runtime-security-automation -->';

function exactSha(value, label) {
  assert.match(value ?? '', /^[0-9a-f]{40}$/, label);
  return value;
}

export function runtimeCandidateBranch(sourceSha) {
  exactSha(sourceSha, 'Expected exact main SHA');
  return 'automation/runtime-security-' + sourceSha.slice(0, 12);
}

export function runtimeCandidateMarker(sourceSha, candidateSha) {
  exactSha(sourceSha, 'Expected exact source SHA');
  exactSha(candidateSha, 'Expected exact candidate SHA');
  return '<!-- vellira-runtime-security-candidate:v1 source-sha=' +
    sourceSha + ' candidate-sha=' + candidateSha + ' -->';
}

function matchingBranchSha(refs, branch) {
  assert.ok(Array.isArray(refs), 'Expected authenticated Git ref collection');
  const matches = refs.filter((entry) => entry?.ref === 'refs/heads/' + branch);
  assert.ok(matches.length <= 1, 'Ambiguous canonical candidate branch');
  if (!matches.length) return null;
  assert.equal(matches[0]?.object?.type, 'commit');
  return exactSha(matches[0]?.object?.sha, 'Invalid candidate branch SHA');
}

function verifyCandidateCommit(commit, sourceSha, branchSha, expectedTree) {
  assert.ok(commit && typeof commit === 'object', 'Missing candidate commit');
  assert.equal(commit.sha, branchSha, 'Candidate branch SHA drift');
  assert.deepEqual(
    commit.parents?.map((parent) => parent.sha),
    [sourceSha],
    'Candidate must be a direct child of the authenticated main SHA'
  );
  assert.equal(
    commit.commit?.message,
    RUNTIME_CANDIDATE_MESSAGE,
    'Unexpected candidate commit message'
  );
  exactSha(commit.commit?.tree?.sha, 'Invalid candidate tree SHA');
  const filenames = (commit.files ?? []).map((file) => file?.filename).sort();
  assert.deepEqual(
    filenames,
    ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
    'Candidate must change only the two authorized dependency files'
  );
  if (expectedTree != null) {
    exactSha(expectedTree, 'Invalid regenerated candidate tree');
    assert.equal(
      commit.commit.tree.sha,
      expectedTree,
      'Existing candidate branch differs from regenerated immutable tree'
    );
  }
}

function verifyCandidatePR(pull, repository, branch, sourceSha, branchSha) {
  assert.equal(pull?.state, 'open', 'Canonical candidate PR is not open');
  assert.equal(
    pull?.user?.login,
    RUNTIME_CANDIDATE_AUTHOR,
    'Candidate PR author is not the trusted GitHub App'
  );
  assert.equal(
    pull?.title,
    RUNTIME_CANDIDATE_TITLE,
    'Canonical candidate PR title drift'
  );
  assert.equal(pull?.base?.ref, 'main');
  assert.equal(pull?.base?.repo?.full_name, repository);
  assert.equal(pull?.head?.ref, branch);
  assert.equal(pull?.head?.repo?.full_name, repository);
  assert.equal(
    pull?.head?.sha,
    branchSha,
    'PR no longer refers to the authenticated candidate branch'
  );
  assert.equal(
    typeof pull?.draft,
    'boolean',
    'Canonical candidate PR draft status missing'
  );
  assert.ok(
    Number.isSafeInteger(pull?.number) && pull.number > 0,
    'Canonical candidate PR number missing'
  );

  const body = pull?.body;
  assert.equal(typeof body, 'string', 'Canonical candidate provenance missing');
  const markers = body.match(
    /<!--\s*vellira-runtime-security-candidate:v1[^>]*-->/g
  ) ?? [];
  assert.deepEqual(
    markers,
    [runtimeCandidateMarker(sourceSha, branchSha)],
    'Canonical candidate source and SHA provenance mismatch'
  );
  const intents = body.match(
    /<!--\s*vellira-change-intent:v1:[^>]*-->/g
  ) ?? [];
  assert.deepEqual(
    intents,
    [RUNTIME_CANDIDATE_INTENT],
    'Canonical candidate change-intent authority mismatch'
  );
}

export function inspectRuntimeCandidate({
  refs,
  pulls,
  commit,
  repository,
  sourceSha,
  expectedTree = null,
}) {
  assert.match(
    repository ?? '',
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    'Expected exact repository full name'
  );
  const branch = runtimeCandidateBranch(sourceSha);
  const branchSha = matchingBranchSha(refs, branch);
  if (branchSha) {
    verifyCandidateCommit(commit, sourceSha, branchSha, expectedTree);
  } else {
    assert.equal(commit, null, 'Commit proof supplied without branch');
  }
  assert.ok(Array.isArray(pulls), 'Expected authenticated open PR collection');
  // A spoofed title or same-named branch in a fork is not authoritative.
  const canonicalPulls = pulls.filter(
    (pull) =>
      pull?.head?.ref === branch &&
      pull?.head?.repo?.full_name === repository
  );
  assert.ok(canonicalPulls.length <= 1, 'Ambiguous canonical candidate PRs');
  if (canonicalPulls.length) {
    assert.ok(branchSha, 'Canonical candidate PR has no matching branch');
    verifyCandidatePR(
      canonicalPulls[0],
      repository,
      branch,
      sourceSha,
      branchSha
    );
  }
  return {
    branch,
    branchSha,
    authenticatedPR: canonicalPulls.length
      ? { number: canonicalPulls[0].number, draft: canonicalPulls[0].draft }
      : null,
    orphanedBranch: Boolean(branchSha && canonicalPulls.length === 0),
  };
}

function main(args) {
  const [refsPath, pullsPath, commitPath, repository, sourceSha, expectedTree] =
    args;
  if (!refsPath || !pullsPath || !commitPath || !repository || !sourceSha) {
    throw new Error(
      'Usage: dependabot-runtime-candidate-authority.mjs <refs.json> <pulls.json> <commit.json> <repository> <source-sha> [expected-tree-sha]'
    );
  }
  const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
  process.stdout.write(
    JSON.stringify(
      inspectRuntimeCandidate({
        refs: read(refsPath),
        pulls: read(pullsPath),
        commit: read(commitPath),
        repository,
        sourceSha,
        expectedTree,
      }),
      null,
      2
    ) + '\n'
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
