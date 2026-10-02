import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  RELEASE_SYNC_MANIFESTS,
  isReleaseSyncFileSet,
  verifyMergedReleaseSyncAdvance,
} from '../../../scripts/ci/release-sync-contract.mjs';
import { productionDeploymentRelevantPaths } from './cloudflare-production-surface.mjs';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PRODUCTION_CONFIG = 'wrangler.production.jsonc';
const COMPARE_FILE_LIMIT = 300;

function assertSha(value, label) {
  assert.match(
    value ?? '',
    SHA_PATTERN,
    label + ' must be an exact 40-character lowercase SHA'
  );
  return value;
}

function assertRepository(value) {
  assert.match(
    value ?? '',
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    'GITHUB_REPOSITORY must be owner/name'
  );
  return value;
}

async function githubJson(
  pathname,
  { token, fetchImpl = fetch, apiUrl = 'https://api.github.com' }
) {
  assert.ok(token, 'GITHUB_TOKEN is required for production freshness');
  const response = await fetchImpl(`${apiUrl}${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  assert.equal(
    response.ok,
    true,
    `GitHub API GET ${pathname} failed: ${response.status} ${body}`
  );
  return body ? JSON.parse(body) : null;
}

function encodeRepositoryPath(filePath) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function readJsonAtGitHubRef(
  repository,
  ref,
  filePath,
  options
) {
  const encodedPath = encodeRepositoryPath(filePath);
  const data = await githubJson(
    `/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    options
  );
  assert.equal(
    data?.type,
    'file',
    `Expected ${filePath} at ${ref} to be a GitHub file`
  );
  assert.equal(
    data?.encoding,
    'base64',
    `Expected ${filePath} at ${ref} to use base64 GitHub content encoding`
  );
  assert.equal(
    typeof data?.content,
    'string',
    `Missing GitHub file content for ${filePath} at ${ref}`
  );
  return JSON.parse(
    Buffer.from(data.content.replaceAll('\n', ''), 'base64').toString('utf8')
  );
}

async function releaseSyncDocuments({
  repository,
  candidateSha,
  mainSha,
  fetchImpl,
  apiUrl,
  githubToken,
}) {
  const options = { token: githubToken, fetchImpl, apiUrl };
  const pairs = await Promise.all(
    RELEASE_SYNC_MANIFESTS.map(async (manifestPath) => {
      const [baseDocument, headDocument] = await Promise.all([
        readJsonAtGitHubRef(
          repository,
          candidateSha,
          manifestPath,
          options
        ),
        readJsonAtGitHubRef(repository, mainSha, manifestPath, options),
      ]);
      return [manifestPath, baseDocument, headDocument];
    })
  );

  return {
    baseDocuments: Object.fromEntries(
      pairs.map(([manifestPath, baseDocument]) => [
        manifestPath,
        baseDocument,
      ])
    ),
    headDocuments: Object.fromEntries(
      pairs.map(([manifestPath, , headDocument]) => [
        manifestPath,
        headDocument,
      ])
    ),
  };
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

export function changedPathsFromCompare(comparison) {
  assert.ok(comparison && typeof comparison === 'object', 'Missing compare result');
  assert.ok(
    ['ahead', 'identical'].includes(comparison.status),
    `Production candidate is not an ancestor of current main: compare status ${comparison.status ?? 'missing'}`
  );
  assert.ok(Array.isArray(comparison.files), 'GitHub compare files are missing');
  assert.ok(
    comparison.files.length < COMPARE_FILE_LIMIT,
    `GitHub compare returned ${comparison.files.length} files; deployment freshness is ambiguous at the API file limit`
  );

  const paths = [];
  for (const file of comparison.files) {
    assert.equal(
      typeof file?.filename,
      'string',
      'GitHub compare file is missing filename'
    );
    paths.push(file.filename);
    if (typeof file.previous_filename === 'string') {
      paths.push(file.previous_filename);
    }
  }
  return [...new Set(paths)].sort();
}

export async function assessFreshProductionCandidate({
  configPath,
  candidateSource,
  candidateSha,
  repository = process.env.GITHUB_REPOSITORY,
  mainSha: suppliedMainSha = null,
  githubToken = process.env.GITHUB_TOKEN,
  fetchImpl = fetch,
  apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com',
}) {
  const mode = productionFreshnessMode({ configPath, candidateSource });

  if (mode !== 'staging') {
    return {
      checked: false,
      mode,
      mainSha: null,
      deploymentEquivalent: null,
      changedPaths: [],
      relevantPaths: [],
    };
  }

  assertSha(candidateSha, 'Production candidate SHA');
  assertRepository(repository);

  const mainSha = suppliedMainSha
    ? assertSha(suppliedMainSha, 'Remote main SHA')
    : assertSha(
        (
          await githubJson(
            `/repos/${repository}/git/ref/heads/main`,
            { token: githubToken, fetchImpl, apiUrl }
          )
        )?.object?.sha,
        'Remote main SHA'
      );

  if (mainSha === candidateSha) {
    return {
      checked: true,
      mode,
      mainSha,
      deploymentEquivalent: true,
      changedPaths: [],
      relevantPaths: [],
    };
  }

  const comparison = await githubJson(
    `/repos/${repository}/compare/${candidateSha}...${mainSha}`,
    { token: githubToken, fetchImpl, apiUrl }
  );
  const changedPaths = changedPathsFromCompare(comparison);
  let relevantPaths = productionDeploymentRelevantPaths(changedPaths);

  if (
    relevantPaths.length > 0 &&
    isReleaseSyncFileSet(changedPaths)
  ) {
    const { baseDocuments, headDocuments } = await releaseSyncDocuments({
      repository,
      candidateSha,
      mainSha,
      fetchImpl,
      apiUrl,
      githubToken,
    });
    verifyMergedReleaseSyncAdvance({
      candidateSha,
      mainSha,
      comparison,
      baseDocuments,
      headDocuments,
    });
    relevantPaths = [];
  }

  assert.equal(
    relevantPaths.length,
    0,
    `Production candidate ${candidateSha} is stale; current main is ${mainSha} and deployment-relevant paths changed: ${relevantPaths.slice(0, 12).join(', ')}`
  );

  return {
    checked: true,
    mode,
    mainSha,
    deploymentEquivalent: true,
    changedPaths,
    relevantPaths,
  };
}

export const assertFreshProductionCandidate = assessFreshProductionCandidate;

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const configPath = path.resolve(
    process.cwd(),
    process.argv[2] ?? 'apps/website/wrangler.production.jsonc'
  );
  const evidence = await assertFreshProductionCandidate({
    configPath,
    candidateSource: process.env.CANDIDATE_SOURCE,
    candidateSha: process.env.CANDIDATE_SHA,
  });
  console.log(JSON.stringify(evidence));
}
