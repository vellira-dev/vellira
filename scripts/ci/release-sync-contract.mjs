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

  if (commitSubject !== 'chore(release): sync package versions') {
    throw new Error(
      'Merged release-sync verification requires the canonical commit subject.'
    );
  }

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
