import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RELEASE_SYNC_MANIFESTS = Object.freeze([
  'package.json',
  'packages/core/package.json',
  'packages/icons/package.json',
  'packages/react-native/package.json',
  'packages/react/package.json',
  'packages/tokens/package.json',
  'packages/types/package.json',
]);

export const RELEASE_SYNC_SQUASH_SUBJECT_PATTERN =
  /^chore\(release\): sync package versions \(#\d+\)$/;

const MERGED_SHA_PATTERN = /^[0-9a-f]{40}$/;

function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function isReleaseSyncFileSet(files) {
  const normalized = sorted(files.map(normalizePath));
  return (
    normalized.length === RELEASE_SYNC_MANIFESTS.length &&
    JSON.stringify(normalized) === JSON.stringify(sorted(RELEASE_SYNC_MANIFESTS))
  );
}

function cloneWithoutVersion(manifest) {
  const clone = structuredClone(manifest);
  delete clone.version;
  return clone;
}

function verifyReleaseSyncManifestTransition({
  files,
  baseDocuments,
  headDocuments,
}) {
  if (!isReleaseSyncFileSet(files)) {
    throw new Error(
      'Release-sync fast path requires exactly the seven release-managed package manifests.'
    );
  }

  const baseVersions = new Set();
  const headVersions = new Set();

  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    const baseManifest = baseDocuments[manifestPath];
    const headManifest = headDocuments[manifestPath];

    if (!baseManifest || !headManifest) {
      throw new Error(`Missing release-sync manifest data for ${manifestPath}.`);
    }

    if (
      typeof baseManifest.version !== 'string' ||
      typeof headManifest.version !== 'string'
    ) {
      throw new Error(
        `Release-sync manifest ${manifestPath} must contain string versions.`
      );
    }

    assert.deepStrictEqual(
      cloneWithoutVersion(headManifest),
      cloneWithoutVersion(baseManifest),
      `Release-sync fast path only permits the version field to change in ${manifestPath}.`
    );

    baseVersions.add(baseManifest.version);
    headVersions.add(headManifest.version);
  }

  if (baseVersions.size !== 1) {
    throw new Error('Release-sync base manifests must start at one exact version.');
  }

  if (headVersions.size !== 1) {
    throw new Error('Release-sync head manifests must converge on one exact version.');
  }

  const [baseVersion] = baseVersions;
  const [headVersion] = headVersions;

  if (baseVersion === headVersion) {
    throw new Error('Release-sync fast path requires an actual version change.');
  }

  return {
    baseVersion,
    headVersion,
    files: sorted(files.map(normalizePath)),
  };
}

export function verifyReleaseSyncDocuments({
  files,
  baseDocuments,
  headDocuments,
  title,
  headRef,
  author,
}) {
  if (title !== 'chore(release): sync package versions') {
    throw new Error('Release-sync fast path requires the canonical PR title.');
  }

  if (author !== 'vellira-release-sync[bot]') {
    throw new Error(
      'Release-sync fast path requires the release-sync GitHub App author.'
    );
  }

  const result = verifyReleaseSyncManifestTransition({
    files,
    baseDocuments,
    headDocuments,
  });

  if (headRef !== `chore/sync-release-${result.headVersion}`) {
    throw new Error(
      `Release-sync branch must be chore/sync-release-${result.headVersion}; found ${headRef}.`
    );
  }

  return result;
}

export function verifyMergedReleaseSyncDocuments({
  files,
  baseDocuments,
  headDocuments,
  actor,
  commitSubject,
}) {
  if (actor !== 'vellira-release-sync[bot]') {
    throw new Error(
      'Merged release-sync verification requires the release-sync GitHub App actor.'
    );
  }

  if (
    typeof commitSubject !== 'string' ||
    !RELEASE_SYNC_SQUASH_SUBJECT_PATTERN.test(commitSubject)
  ) {
    throw new Error(
      'Merged release-sync verification requires the canonical squash-merge commit subject.'
    );
  }

  return verifyReleaseSyncManifestTransition({
    files,
    baseDocuments,
    headDocuments,
  });
}

export function verifyMergedReleaseSyncAdvance({
  candidateSha,
  mainSha,
  comparison,
  baseDocuments,
  headDocuments,
}) {
  assert.match(
    candidateSha ?? '',
    MERGED_SHA_PATTERN,
    'Release-sync advance candidate SHA must be exact'
  );
  assert.match(
    mainSha ?? '',
    MERGED_SHA_PATTERN,
    'Release-sync advance main SHA must be exact'
  );
  assert.ok(
    comparison && typeof comparison === 'object',
    'Release-sync advance requires a GitHub compare result'
  );
  assert.equal(
    comparison.status,
    'ahead',
    'Release-sync advance requires current main to be strictly ahead'
  );
  assert.equal(
    comparison.behind_by,
    0,
    'Release-sync advance cannot include a diverged candidate'
  );
  assert.ok(
    Number.isInteger(comparison.total_commits) && comparison.total_commits > 0,
    'Release-sync advance requires at least one exact commit'
  );
  assert.equal(
    comparison.ahead_by,
    comparison.total_commits,
    'Release-sync advance compare counts must be exact'
  );
  assert.ok(
    Array.isArray(comparison.commits),
    'Release-sync advance requires compare commit evidence'
  );
  assert.equal(
    comparison.commits.length,
    comparison.total_commits,
    'Release-sync advance commit evidence must be complete'
  );
  assert.ok(
    Array.isArray(comparison.files),
    'Release-sync advance requires compare file evidence'
  );

  const files = comparison.files.map((file) => {
    assert.equal(
      typeof file?.filename,
      'string',
      'Release-sync advance file is missing filename'
    );
    assert.equal(
      file.status,
      'modified',
      `Release-sync advance only permits modified manifests; found ${file.status ?? 'missing'} for ${file.filename}`
    );
    assert.equal(
      file.previous_filename,
      undefined,
      `Release-sync advance cannot rename ${file.filename}`
    );
    return file.filename;
  });

  if (!isReleaseSyncFileSet(files)) {
    throw new Error(
      'Release-sync advance requires exactly the seven release-managed package manifests.'
    );
  }

  let expectedParent = candidateSha;
  for (const commit of comparison.commits) {
    assert.match(
      commit?.sha ?? '',
      MERGED_SHA_PATTERN,
      'Release-sync advance commit SHA must be exact'
    );
    assert.equal(
      commit?.author?.login,
      'vellira-release-sync[bot]',
      'Release-sync advance requires the release-sync GitHub App actor'
    );
    const subject =
      typeof commit?.commit?.message === 'string'
        ? commit.commit.message.split(/\r?\n/, 1)[0]
        : '';
    assert.match(
      subject,
      RELEASE_SYNC_SQUASH_SUBJECT_PATTERN,
      'Release-sync advance requires canonical squash-merge commit subjects'
    );
    assert.equal(
      commit?.parents?.length,
      1,
      'Release-sync advance must remain a linear single-parent chain'
    );
    assert.equal(
      commit.parents[0]?.sha,
      expectedParent,
      'Release-sync advance parent chain must start at the staged candidate and remain contiguous'
    );
    expectedParent = commit.sha;
  }

  assert.equal(
    expectedParent,
    mainSha,
    'Release-sync advance commit chain must end at current main'
  );

  return verifyReleaseSyncManifestTransition({
    files,
    baseDocuments,
    headDocuments,
  });
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJsonAt(ref, manifestPath) {
  const raw = git(['show', `${ref}:${manifestPath}`]);
  return JSON.parse(raw);
}

async function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const base = argumentValue(args, '--base');
  const head = argumentValue(args, '--head');

  if (!base || !head) {
    throw new Error(
      'Usage: node scripts/ci/release-sync-contract.mjs --base <sha> --head <sha> [--detect|--verify|--verify-merged]'
    );
  }

  const mergedMode = args.includes('--verify-merged');
  if (mergedMode) {
    const parents = git(['rev-list', '--parents', '-n', '1', head])
      .split(/\s+/)
      .slice(1);
    if (parents.length !== 1 || parents[0] !== base) {
      throw new Error(
        'Merged release-sync verification requires one exact first parent matching --base.'
      );
    }
  }

  const range = mergedMode ? `${base}..${head}` : `${base}...${head}`;
  const files = git(['diff', '--name-only', range])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);

  const candidate = isReleaseSyncFileSet(files);
  await writeOutput('release_sync', candidate ? 'true' : 'false');

  if (args.includes('--detect')) {
    process.stdout.write(
      `${JSON.stringify({ releaseSync: candidate, files: sorted(files) }, null, 2)}\n`
    );
    return;
  }

  const verifyPr = args.includes('--verify');
  if (!verifyPr && !mergedMode) {
    throw new Error(
      'Choose exactly one mode: --detect, --verify, or --verify-merged.'
    );
  }

  if (verifyPr && mergedMode) {
    throw new Error('Release-sync verification modes are mutually exclusive.');
  }

  const baseDocuments = {};
  const headDocuments = {};
  for (const manifestPath of RELEASE_SYNC_MANIFESTS) {
    baseDocuments[manifestPath] = readJsonAt(base, manifestPath);
    headDocuments[manifestPath] = readJsonAt(head, manifestPath);
  }

  const result = mergedMode
    ? verifyMergedReleaseSyncDocuments({
        files,
        baseDocuments,
        headDocuments,
        actor: process.env.VELLIRA_PUSH_ACTOR,
        commitSubject: git(['show', '-s', '--format=%s', head]),
      })
    : verifyReleaseSyncDocuments({
        files,
        baseDocuments,
        headDocuments,
        title: process.env.VELLIRA_PR_TITLE,
        headRef: process.env.VELLIRA_PR_HEAD_REF,
        author: process.env.VELLIRA_PR_AUTHOR,
      });

  await writeOutput('release_sync', 'true');
  process.stdout.write(
    `Verified canonical release sync ${result.baseVersion} -> ${result.headVersion}.\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
