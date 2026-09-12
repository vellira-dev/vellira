#!/usr/bin/env node
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  recovery: {
    assertTrustedPublishingEnvironment,
    createPackageInfo,
    publicPackages,
    publishPackage,
  },
} = require('../semantic-release-packages.cjs');
const {
  RELEASE_WORKFLOW,
  REPOSITORY,
  assessGithubRelease,
  assertTaggedCheckout,
  assertTaggedSourceChanges,
  assertTagState,
  planPackageRecovery,
  validateInputs,
  verifyRegistryEvidence,
} = require('./recovery.cjs');

const command = process.argv[2];
const input = validateInputs({
  version: process.env.RELEASE_VERSION,
  expectedTagSha: process.env.EXPECTED_TAG_SHA,
  confirmation: process.env.RECOVERY_CONFIRMATION,
});
const githubToken = process.env.GITHUB_TOKEN;
const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const controlSha = process.env.GITHUB_SHA;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `${label}: HTTP ${response.status} ${text}`);
  return body;
}

async function github(pathname, options = {}) {
  assert.ok(githubToken, 'GITHUB_TOKEN is required');
  const response = await fetch(`${api}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  return { response, body: await response.text() };
}

async function githubJson(pathname, options) {
  const { response, body } = await github(pathname, options);
  return responseJson(
    new Response(body, { status: response.status }),
    pathname
  );
}

async function resolveRemoteTag() {
  let object = (
    await githubJson(`/repos/${REPOSITORY}/git/ref/tags/${input.tag}`)
  ).object;
  const seen = new Set();
  while (object.type === 'tag') {
    assert.equal(seen.has(object.sha), false, 'Recursive annotated tag');
    seen.add(object.sha);
    object = (await githubJson(`/repos/${REPOSITORY}/git/tags/${object.sha}`))
      .object;
  }
  assert.equal(
    object.type,
    'commit',
    'Release tag does not resolve to a commit'
  );
  return object.sha;
}

async function currentMainSha() {
  return (await githubJson(`/repos/${REPOSITORY}/git/ref/heads/main`)).object
    .sha;
}

async function assertImmutableGitState() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Recovery is workflow-only');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.ok(controlSha, 'Missing workflow source SHA');
  const mainSha = await currentMainSha();
  assert.equal(mainSha, controlSha, 'main moved after recovery dispatch');
  const tagSha = await resolveRemoteTag();
  const comparison = await githubJson(
    `/repos/${REPOSITORY}/compare/${input.expectedTagSha}...${mainSha}`
  );
  assertTagState({
    tagExists: true,
    tagSha,
    expectedTagSha: input.expectedTagSha,
    reachableFromMain: ['ahead', 'identical'].includes(comparison.status),
  });
  assert.equal(git('rev-parse', `${input.tag}^{commit}`), input.expectedTagSha);
  return { mainSha, tagSha, comparisonStatus: comparison.status };
}

function decodeAttestations(body) {
  assert.ok(
    Array.isArray(body?.attestations),
    'Invalid npm attestation response'
  );
  return body.attestations;
}

async function registryState(packageName) {
  const encoded = encodeURIComponent(packageName);
  const metadataResponse = await fetch(
    `https://registry.npmjs.org/${encoded}/${input.version}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (metadataResponse.status === 404)
    return { exists: false, verified: false, packageName };
  const metadata = await responseJson(
    metadataResponse,
    `${packageName}@${input.version}`
  );
  assert.equal(metadata.name, packageName);
  assert.equal(metadata.version, input.version);
  assert.ok(metadata.dist?.attestations?.url, 'Missing attestation URL');
  const attestationResponse = await fetch(metadata.dist.attestations.url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const attestationBody = await responseJson(
    attestationResponse,
    `${packageName} attestations`
  );
  const evidence = verifyRegistryEvidence(
    {
      packageName,
      version: input.version,
      dist: metadata.dist,
      attestations: decodeAttestations(attestationBody),
    },
    { allowedSourceShas: [input.expectedTagSha, controlSha] }
  );
  return { exists: true, verified: true, packageName, ...evidence };
}

async function packageStates() {
  const entries = await Promise.all(
    publicPackages.map(async (name) => [name, await registryState(name)])
  );
  return Object.fromEntries(entries);
}

async function existingRelease() {
  const { response, body } = await github(
    `/repos/${REPOSITORY}/releases/tags/${input.tag}`
  );
  if (response.status === 404) return null;
  return responseJson(
    new Response(body, { status: response.status }),
    'GitHub Release lookup'
  );
}

function previousTag() {
  const previous = git('describe', '--tags', '--abbrev=0', `${input.tag}^`);
  assert.match(previous, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  return previous;
}

function writeOutput(name, value) {
  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function preflight() {
  const gitState = await assertImmutableGitState();
  const states = await packageStates();
  const plan = planPackageRecovery(publicPackages, states);
  const release = await existingRelease();
  if (release) {
    assert.equal(release.tag_name, input.tag);
    assert.equal(release.draft, false);
    assert.equal(release.prerelease, false);
  }
  const evidence = {
    input,
    gitState,
    previousTag: previousTag(),
    packages: states,
    plan,
    githubRelease: release
      ? { exists: true, id: release.id, tagName: release.tag_name }
      : { exists: false },
  };
  writeOutput('missing_count', plan.publish.length);
  writeOutput('previous_tag', evidence.previousTag);
  console.log(JSON.stringify(evidence, null, 2));
}

async function packages() {
  await assertImmutableGitState();
  assertTaggedCheckout({
    checkoutSha: git('rev-parse', 'HEAD'),
    expectedTagSha: input.expectedTagSha,
  });
  assertTaggedSourceChanges(
    git('diff', '--name-only').split('\n').filter(Boolean)
  );
  const states = await packageStates();
  const plan = planPackageRecovery(publicPackages, states);
  if (plan.publish.length > 0) {
    assertTrustedPublishingEnvironment();
    for (const packageName of plan.publish) {
      await assertImmutableGitState();
      const packageInfo = createPackageInfo(packageName);
      assert.equal(packageInfo.version, input.version);
      const result = await publishPackage(packageInfo);
      assert.equal(result.error, undefined, result.error?.message);
    }
  }
  const verified = await packageStates();
  const finalPlan = planPackageRecovery(publicPackages, verified);
  assert.deepEqual(
    finalPlan.publish,
    [],
    'Package recovery remains incomplete'
  );
  console.log(
    JSON.stringify({ input, initialPlan: plan, packages: verified }, null, 2)
  );
}

async function githubRelease() {
  await assertImmutableGitState();
  const states = await packageStates();
  const plan = planPackageRecovery(publicPackages, states);
  assert.deepEqual(plan.publish, [], 'All npm packages must be verified first');
  const previous = previousTag();
  const generated = await githubJson(
    `/repos/${REPOSITORY}/releases/generate-notes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: input.tag,
        target_commitish: input.expectedTagSha,
        previous_tag_name: previous,
      }),
    }
  );
  const expected = {
    tagName: input.tag,
    name: generated.name,
    body: generated.body,
  };
  const current = await existingRelease();
  const decision = assessGithubRelease(current, expected);
  let release = current;
  if (decision.action === 'create') {
    await assertImmutableGitState();
    execFileSync(
      'gh',
      [
        'release',
        'create',
        input.tag,
        '--repo',
        REPOSITORY,
        '--verify-tag',
        '--target',
        input.expectedTagSha,
        '--title',
        generated.name,
        '--notes-file',
        '-',
      ],
      {
        encoding: 'utf8',
        input: generated.body,
        env: { ...process.env, GH_TOKEN: githubToken },
        stdio: ['pipe', 'pipe', 'inherit'],
      }
    );
    release = await existingRelease();
    assert.ok(release, 'GitHub Release was not visible after creation');
  }
  assessGithubRelease(release, expected);
  console.log(
    JSON.stringify(
      {
        input,
        previousTag: previous,
        decision,
        releaseId: release.id,
        htmlUrl: release.html_url,
      },
      null,
      2
    )
  );
}

const commands = { preflight, packages, 'github-release': githubRelease };
assert.ok(
  commands[command],
  `Usage: ${path.basename(process.argv[1])} <${Object.keys(commands).join('|')}>`
);
commands[command]().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
