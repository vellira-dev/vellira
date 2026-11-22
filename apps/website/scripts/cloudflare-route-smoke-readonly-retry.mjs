import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const OWNER = 'vellira-dev/vellira';
const DEPLOY_JOB = 'Build, deploy, and verify merged main on website staging';
const ROUTE_STEP = 'Smoke test deployed routes';
const STAGING = 'https://vellira-website-staging.vellira.workers.dev';
const SHA = /^[0-9a-f]{40}$/;

const ROUTES = Object.freeze([
  { path: '/', terms: ['Vellira'] },
  { path: '/components/switch', terms: ['data-component-explorer-main', '>Switch</h1>'] },
  { path: '/blog', terms: ['<h1>Blog</h1>', 'aria-label="Published articles"'] },
  { path: '/blog/two-runtimes', terms: ['One Design System, Two Runtimes', 'data-language="ts"'] },
  { path: '/blog/rss.xml', terms: ['<rss version="2.0"'] },
  { path: '/sitemap.xml', terms: ['<urlset'] },
  { path: '/robots.txt', terms: ['User-Agent: *'] },
]);

// Only the exact previously FAILED read-only route smoke is eligible.
// Other failures (auth, archive, CSS, browser, SEO) require separate review.
export function classifyRouteSmokeRetry({ jobs }) {
  assert.ok(Number.isSafeInteger(jobs?.total_count) && jobs.total_count >= 0 && jobs.total_count < 100);
  assert.ok(Array.isArray(jobs.jobs) && jobs.jobs.length === jobs.total_count, 'Incomplete job evidence');
  const deploymentJobs = jobs.jobs.filter(job => job.name === DEPLOY_JOB);
  assert.equal(deploymentJobs.length, 1, 'Exactly one deployment job required');
  const job = deploymentJobs[0];
  assert.equal(job.conclusion, 'failure', 'Deployment job must have failed');
  assert.ok(Array.isArray(job.steps), 'Missing step evidence');
  const failed = job.steps.filter(step => step.conclusion === 'failure');
  assert.equal(failed.length, 1, 'Exactly one failed step required');
  assert.equal(failed[0].name, ROUTE_STEP, 'Failure is not the allowlisted route smoke');
  const steps = job.steps.filter(step => step.name === ROUTE_STEP);
  assert.equal(steps.length, 1, 'Ambiguous route smoke step');
  assert.equal(steps[0].status, 'completed', 'Route smoke did not complete');
  return { eligible: true, failedStep: ROUTE_STEP };
}

export async function retryRouteSmokeReadOnly({
  base = STAGING,
  fetchImpl = fetch,
  maxAttempts = 3,
  timeoutMs = 10000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = console.log,
}) {
  assert.equal(base, STAGING, 'Only canonical staging may be read');
  assert.equal(maxAttempts, 3, 'Retry policy is fixed to three attempts per route');
  const results = [];
  for (const route of ROUTES) {
    let passed = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const url = new URL(route.path, STAGING);
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = response.status === 200 ? await response.text() : '';
      if (response.status === 200 && route.terms.every(term => body.includes(term))) {
        results.push({ path: route.path, attempts: attempt, status: 'passed' });
        passed = true;
        break;
      }
      if (attempt < maxAttempts) await sleep(2000);
    }
    if (!passed) throw new Error('Read-only route smoke failed: ' + route.path);
  }
  const receipt = { status: 'diagnostic-route-smoke-passed', routes: results.length, results,
    note: 'Read-only diagnostic only; not full staging acceptance or production promotion authority' };
  log(JSON.stringify(receipt));
  return receipt;
}

async function githubGet(path) {
  assert.ok(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN required');
  const response = await fetch('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'GitHub GET failed: ' + response.status);
  return response.json();
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  const id = Number(process.env.FAILED_STAGING_RUN_ID);
  const attempt = Number(process.env.FAILED_STAGING_RUN_ATTEMPT);
  const sha = process.env.FAILED_STAGING_SOURCE_SHA;
  assert.ok(Number.isSafeInteger(id) && id > 0);
  assert.ok(Number.isSafeInteger(attempt) && attempt > 0);
  assert.match(sha ?? '', SHA);
  const [run, jobs] = await Promise.all([
    githubGet('/repos/' + OWNER + '/actions/runs/' + id),
    githubGet('/repos/' + OWNER + '/actions/runs/' + id + '/jobs?per_page=100'),
  ]);
  assert.equal(run.id, id);
  assert.equal(run.repository?.full_name, OWNER);
  assert.equal(run.path, '.github/workflows/deploy-website-cloudflare-staging.yml');
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, sha);
  assert.equal(run.run_attempt, attempt);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'failure');
  classifyRouteSmokeRetry({ jobs });
  // A preceding step has already proved active Worker identity. The next
  // workflow step must prove it AGAIN after all route requests.
  await retryRouteSmokeReadOnly({});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
