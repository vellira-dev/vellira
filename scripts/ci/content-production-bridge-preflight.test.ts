import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BridgePreflightError,
  validateBridgePreflight,
} from './content-production-bridge-preflight.mjs';

const SHA = 'a'.repeat(40);
const WORKFLOW_HEAD = 'b'.repeat(40);
const RUN_ID = 38251246967;
const ATTEMPT = 2;
const BUILD_ID = SHA + '-' + RUN_ID + '-' + ATTEMPT;
const ARTICLE = 'https://vellira.dev/blog/two-runtimes';
const REQUIRED_STEPS = [
  'Verify exact production candidate checkout',
  'Deploy production website to Cloudflare Workers',
  'Smoke test production routes',
  'Verify deployed identities, freshness and immutable bytes',
  'Smoke test production static chunk integrity',
];

function fixture() {
  return {
    runId: RUN_ID,
    attempt: ATTEMPT,
    slug: 'two-runtimes',
    run: {
      id: RUN_ID,
      run_attempt: ATTEMPT,
      repository: { full_name: 'vellira-dev/vellira' },
      path: '.github/workflows/deploy-website-cloudflare-production.yml',
      event: 'workflow_run',
      head_branch: 'main',
      head_sha: WORKFLOW_HEAD,
      status: 'completed',
      conclusion: 'success',
    },
    jobs: {
      total_count: 1,
      jobs: [
        {
          name: 'Deploy and verify approved production candidate',
          run_id: RUN_ID,
          status: 'completed',
          conclusion: 'success',
          steps: REQUIRED_STEPS.map((name) => ({
            name,
            conclusion: 'success',
          })),
        },
      ],
    },
    runtime: {
      buildId: BUILD_ID,
      workerVersion: 'cloudflare-version',
    },
    article: {
      status: 200,
      url: ARTICLE,
      headers:
        'HTTP/2 200\r\ncontent-type: text/html; charset=utf-8\r\n' +
        'x-vellira-build-id: ' +
        BUILD_ID +
        '\r\n\r\n',
      html:
        '<html><head><link href="' +
        ARTICLE +
        '" rel="canonical"/></head></html>',
    },
  };
}

describe('read-only content production bridge preflight', () => {
  it('accepts a deployed candidate different from production workflow HEAD', () => {
    const result = validateBridgePreflight(fixture());
    expect(result.status).toBe('read_only_verified');
    expect(result.workflowCheckoutShaDiffers).toBe(true);
    expect(result.deployedCandidateSha).toBe(SHA);
    expect(result.productionRunAttempt).toBe(2);
    expect(result.canonicalUrl).toBe(ARTICLE);
    expect(result.externalPublishingAuthorized).toBe(false);
    expect(result.repositoryDispatchSent).toBe(false);
    expect(result.containsCredentials).toBe(false);
  });

  it.each([
    ['wrong repository', (x: ReturnType<typeof fixture>) => (x.run.repository.full_name = 'attacker/repo')],
    ['wrong source path', (x: ReturnType<typeof fixture>) => (x.run.path = '.github/workflows/staging.yml')],
    ['wrong workflow event', (x: ReturnType<typeof fixture>) => (x.run.event = 'workflow_dispatch')],
    ['wrong branch', (x: ReturnType<typeof fixture>) => (x.run.head_branch = 'feature')],
    ['wrong attempt', (x: ReturnType<typeof fixture>) => (x.run.run_attempt = 1)],
    ['failed source run', (x: ReturnType<typeof fixture>) => (x.run.conclusion = 'failure')],
    ['failed deploy', (x: ReturnType<typeof fixture>) => (x.jobs.jobs[0].conclusion = 'failure')],
    ['skipped deploy', (x: ReturnType<typeof fixture>) => (x.jobs.jobs[0].conclusion = 'skipped')],
    ['missing step', (x: ReturnType<typeof fixture>) => x.jobs.jobs[0].steps.pop()],
    ['incomplete jobs page', (x: ReturnType<typeof fixture>) => (x.jobs.total_count = 2)],
    ['stale active build', (x: ReturnType<typeof fixture>) => (x.runtime.buildId = SHA + '-1-2')],
    ['missing worker version', (x: ReturnType<typeof fixture>) => (x.runtime.workerVersion = '')],
    ['HTTP 404', (x: ReturnType<typeof fixture>) => (x.article.status = 404)],
    ['redirected article', (x: ReturnType<typeof fixture>) => (x.article.url = 'https://evil.invalid')],
    ['stale article build', (x: ReturnType<typeof fixture>) => (x.article.headers = 'HTTP/2 200\ncontent-type: text/html\nx-vellira-build-id: old\n\n')],
    ['wrong canonical', (x: ReturnType<typeof fixture>) => (x.article.html = '<link rel="canonical" href="https://evil.invalid">')],
    ['duplicate canonical', (x: ReturnType<typeof fixture>) => (x.article.html += '<link rel="canonical" href="' + ARTICLE + '">')],
    ['invalid slug', (x: ReturnType<typeof fixture>) => (x.slug = '../private')],
  ])('rejects %s', (_label, modify) => {
    const data = fixture();
    modify(data);
    expect(() => validateBridgePreflight(data)).toThrow(
      BridgePreflightError
    );
  });

  it('requires actual successful deploy job, not merely successful workflow', () => {
    const data = fixture();
    data.jobs.jobs = [];
    data.jobs.total_count = 0;
    expect(() => validateBridgePreflight(data)).toThrow(
      'Exact production deploy job did not succeed.'
    );
  });

  it('does not access secrets, use a GitHub App or dispatch a repository event', () => {
    const workflow = readFileSync(
      new URL(
        '../../.github/workflows/content-production-bridge-preflight.yml',
        import.meta.url
      ),
      'utf8'
    );
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('permissions:\n  contents: read\n  actions: read');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('content-production-bridge-preflight.mjs');
    expect(workflow).toContain('https://vellira.dev/__vellira_runtime');
    expect(workflow).not.toContain('repository_dispatch:');
    expect(workflow).not.toContain('permission-contents: write');
    expect(workflow).not.toContain('create-github-app-token');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toContain('environment:');
    expect(workflow).not.toContain('gh api --method POST');
  });
});
