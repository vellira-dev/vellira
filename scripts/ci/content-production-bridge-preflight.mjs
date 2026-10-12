/** Read-only post-deployment proof for the existing Content Distribution bridge. */
import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[0-9a-f]{40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_REPOSITORY = 'vellira-dev/vellira';
const SOURCE_WORKFLOW = '.github/workflows/deploy-website-cloudflare-production.yml';
const DEPLOY_JOB = 'Deploy and verify approved production candidate';
const REQUIRED_STEPS = new Set([
  'Verify exact production candidate checkout',
  'Deploy production website to Cloudflare Workers',
  'Smoke test production routes',
  'Verify deployed identities, freshness and immutable bytes',
  'Smoke test production static chunk integrity',
]);

export class BridgePreflightError extends Error {}

function requireRunNumber(value, name) {
  const parsed = Number(value);
  if (
    !/^[1-9][0-9]*$/.test(String(value)) ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    throw new BridgePreflightError(name + ' must be a positive safe integer.');
  }
  return parsed;
}

function requireMapping(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BridgePreflightError(name + ' must be an object.');
  }
  return value;
}

function getHeader(rawHeaders, name) {
  const sections = String(rawHeaders).replace(/\r/g, '').split(/\n\n/);
  const last = sections.filter((part) => /^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(part)).at(-1);
  if (!last) throw new BridgePreflightError('Canonical HTTP headers are missing.');
  const header = last
    .split('\n')
    .slice(1)
    .find((line) => line.toLowerCase().startsWith(name.toLowerCase() + ':'));
  return header ? header.slice(header.indexOf(':') + 1).trim() : null;
}

function canonicalLinks(html) {
  const links = [];
  const tags = String(html).match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = {};
    for (const match of tag.matchAll(/\b([a-zA-Z-]+)\s*=\s*["']([^"']*)["']/g)) {
      attrs[match[1].toLowerCase()] = match[2];
    }
    if (String(attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')) {
      links.push(attrs.href ?? '');
    }
  }
  return links;
}

/**
 * This does not grant dispatch, editorial approval, or external publish authority.
 * The workflow-run checkout HEAD can differ from its actual deployed candidate SHA.
 */
export function validateBridgePreflight(input) {
  const run = requireMapping(input.run, 'production run');
  const responseJobs = requireMapping(input.jobs, 'attempt jobs');
  const runtime = requireMapping(input.runtime, 'active runtime');
  const article = requireMapping(input.article, 'canonical article');
  const runId = requireRunNumber(input.runId, 'run ID');
  const attempt = requireRunNumber(input.attempt, 'run attempt');
  const slug = input.slug;

  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    throw new BridgePreflightError('Invalid canonical article slug.');
  }
  if (
    run.repository?.full_name !== SOURCE_REPOSITORY ||
    run.path !== SOURCE_WORKFLOW ||
    run.event !== 'workflow_run' ||
    run.head_branch !== 'main' ||
    !SHA40.test(run.head_sha ?? '') ||
    run.id !== runId ||
    run.run_attempt !== attempt ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  ) {
    throw new BridgePreflightError('Production workflow authority not proven.');
  }

  const jobs = responseJobs.jobs;
  if (
    !Array.isArray(jobs) ||
    responseJobs.total_count !== jobs.length
  ) {
    throw new BridgePreflightError('Production job evidence is incomplete.');
  }
  const deploy = jobs.filter((job) => job?.name === DEPLOY_JOB);
  if (deploy.length !== 1 ||
      deploy[0].run_id !== runId ||
      deploy[0].status !== 'completed' ||
      deploy[0].conclusion !== 'success') {
    throw new BridgePreflightError('Exact production deploy job did not succeed.');
  }
  const completedSteps = new Set(
    (deploy[0].steps ?? [])
      .filter((step) => step?.conclusion === 'success')
      .map((step) => step.name)
  );
  if (![...REQUIRED_STEPS].every((step) => completedSteps.has(step))) {
    throw new BridgePreflightError('Required production verification did not succeed.');
  }

  const build = runtime.buildId;
  const expectedSuffix = '-' + runId + '-' + attempt;
  const candidateSha =
    typeof build === 'string' && build.endsWith(expectedSuffix)
      ? build.slice(0, -expectedSuffix.length)
      : '';
  if (
    !SHA40.test(candidateSha) ||
    !runtime.workerVersion ||
    typeof runtime.workerVersion !== 'string'
  ) {
    throw new BridgePreflightError('Live deployment identity is not the verified run.');
  }

  const url = 'https://vellira.dev/blog/' + slug;
  if (
    article.status !== 200 ||
    article.url !== url ||
    getHeader(article.headers, 'x-vellira-build-id') !== build ||
    !(getHeader(article.headers, 'content-type') ?? '').toLowerCase().startsWith('text/html') ||
    !Array.isArray(canonicalLinks(article.html)) ||
    canonicalLinks(article.html).length !== 1 ||
    canonicalLinks(article.html)[0] !== url
  ) {
    throw new BridgePreflightError('Active canonical article does not match this build.');
  }

  return {
    schemaVersion: 1,
    status: 'read_only_verified',
    sourceRepository: SOURCE_REPOSITORY,
    productionRunId: runId,
    productionRunAttempt: attempt,
    deployedCandidateSha: candidateSha,
    buildId: build,
    canonicalUrl: url,
    workflowCheckoutShaDiffers: run.head_sha !== candidateSha,
    externalPublishingAuthorized: false,
    humanApprovalGranted: false,
    repositoryDispatchSent: false,
    containsCredentials: false,
  };
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, 'utf8'));
}

function main() {
  const temp = process.env.RUNNER_TEMP;
  if (!temp) throw new BridgePreflightError('Runner temporary directory unavailable.');
  const meta = readFileSync(path.join(temp, 'bridge-article-meta.txt'), 'utf8')
    .trim().split('\n');
  if (meta.length !== 2) {
    throw new BridgePreflightError('Canonical HTTP metadata is malformed.');
  }
  const result = validateBridgePreflight({
    run: readJson(path.join(temp, 'bridge-production-run.json')),
    jobs: readJson(path.join(temp, 'bridge-production-jobs.json')),
    runtime: readJson(path.join(temp, 'bridge-production-runtime.json')),
    article: {
      status: Number(meta[0]),
      url: meta[1],
      headers: readFileSync(path.join(temp, 'bridge-article-headers.txt'), 'utf8'),
      html: readFileSync(path.join(temp, 'bridge-article.html'), 'utf8'),
    },
    runId: process.env.PRODUCTION_RUN_ID,
    attempt: process.env.PRODUCTION_RUN_ATTEMPT,
    slug: process.env.CANONICAL_ARTICLE_SLUG,
  });

  const summary = [
    '# Content Production Bridge — read-only preflight',
    '',
    '- Outcome: **' + result.status + '**',
    '- Source run: `' + result.productionRunId + '` attempt `' +
      result.productionRunAttempt + '`',
    '- Candidate SHA: `' + result.deployedCandidateSha + '`',
    '- Active build: `' + result.buildId + '`',
    '- Canonical page: ' + result.canonicalUrl,
    '- Workflow checkout SHA differs: `' + result.workflowCheckoutShaDiffers + '`',
    '- Repository dispatch: **NOT SENT**',
    '- Editorial approval / external publishing: **NOT AUTHORIZED**',
    '- Credentials / protected Environment: **NOT TESTED**',
    '',
  ];
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    console.error(
      error instanceof BridgePreflightError ? error.message : 'Bridge preflight failed.'
    );
    process.exitCode = 1;
  }
}
