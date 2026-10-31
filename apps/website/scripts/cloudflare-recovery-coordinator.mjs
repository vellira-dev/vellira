import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const STAGING = 'deploy-website-cloudflare-staging.yml';
const PRODUCTION = 'deploy-website-cloudflare-production.yml';
const OWNER = 'vellira-dev/vellira';
const RUNTIME_URL = 'https://vellira.dev/__vellira_runtime';

export function decideRecovery({ mainSha, productionSha, stagingRuns, productionRuns }) {
  assert.match(mainSha, SHA);
  assert.match(productionSha, SHA);
  assert.ok(Array.isArray(stagingRuns) && Array.isArray(productionRuns));
  if (productionSha === mainSha) return { dispatch: false, reason: 'already_deployed' };
  // Do not race a real active production deployment.
  if (productionRuns.some((run) => run.status !== 'completed' && run.status !== 'waiting')) {
    return { dispatch: false, reason: 'production_active' };
  }
  // Exactly one recovery attempt per SHA. A failed attempt requires owner investigation,
  // not a runaway loop. Any existing full stage for the SHA also suppresses duplicates.
  if (stagingRuns.some((run) => run.head_sha === mainSha &&
      (run.event === 'workflow_dispatch' || run.event === 'push'))) {
    return { dispatch: false, reason: 'staging_exists_for_main' };
  }
  return { dispatch: true, reason: 'production_behind_unstaged_main' };
}

async function github(path, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  assert.ok(token, 'GITHUB_TOKEN required');
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(response.ok, 'GitHub ' + method + ' ' + path + ': ' + response.status);
  return response.status === 204 ? null : response.json();
}

async function runtimeSha() {
  const response = await fetch(RUNTIME_URL, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Production runtime must be externally verified');
  const data = await response.json();
  // Only accept the explicit immutable build ID, never infer from page text.
  const buildId = data.buildId ?? data.build?.buildId;
  assert.equal(typeof buildId, 'string', 'Missing production build identity');
  const match = /^([0-9a-f]{40})-\d+-\d+$/.exec(buildId);
  assert.ok(match, 'Invalid production build identity');
  return match[1];
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  const [ref, productionSha, productionResult] = await Promise.all([
    github('/repos/' + OWNER + '/git/ref/heads/main'),
    runtimeSha(),
    github('/repos/' + OWNER + '/actions/workflows/' + PRODUCTION + '/runs?per_page=100'),
  ]);
  const mainSha = ref.object?.sha;
  assert.match(mainSha, SHA);
  const stagingResult = await github('/repos/' + OWNER + '/actions/workflows/' + STAGING + '/runs?head_sha=' + mainSha + '&per_page=100');
  // Fail closed if pagination could conceal earlier recovery for current SHA.
  assert.ok(stagingResult.total_count < 100, 'Staging history requires pagination before safe dispatch');
  const plan = decideRecovery({
    mainSha, productionSha, stagingRuns: stagingResult.workflow_runs,
    productionRuns: productionResult.workflow_runs,
  });
  console.log(JSON.stringify({ mainSha, productionSha, ...plan }));
  if (!plan.dispatch) return;
  // Recheck main immediately before dispatch to narrow the TOCTOU window.
  const latest = await github('/repos/' + OWNER + '/git/ref/heads/main');
  assert.equal(latest.object?.sha, mainSha, 'main changed; defer recovery');
  await github('/repos/' + OWNER + '/actions/workflows/' + STAGING + '/dispatches', {
    method: 'POST',
    body: { ref: 'main', inputs: {
      production_recovery: 'true', pro_interest_preview: 'false', newsletter_abuse_preview: 'false',
    } },
  });
  console.log('Recovery staging dispatched for ' + mainSha);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
