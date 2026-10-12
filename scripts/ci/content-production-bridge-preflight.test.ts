import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BridgePreflightError,
  validateBridgePreflight,
} from './content-production-bridge-preflight.mjs';

const SHA = 'a'.repeat(40);
const WORKFLOW_SHA = 'b'.repeat(40);
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
      head_sha: WORKFLOW_SHA,
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

function mustReject(change: (data: ReturnType<typeof fixture>) => void) {
  const data = fixture();
  change(data);
  expect(() => validateBridgePreflight(data)).toThrow(BridgePreflightError);
}

describe('read-only content production bridge preflight', () => {
  it('accepts verified production when workflow HEAD differs from deployed SHA', () => {
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

  it('rejects untrusted source workflow identity', () => {
    mustReject((x) => {
      x.run.repository.full_name = 'attacker/repo';
    });
    mustReject((x) => {
      x.run.path = 'different-workflow.yml';
    });
    mustReject((x) => {
      x.run.event = 'workflow_dispatch';
    });
    mustReject((x) => {
      x.run.head_branch = 'feature';
    });
    mustReject((x) => {
      x.run.run_attempt = 1;
    });
    mustReject((x) => {
      x.run.conclusion = 'failure';
    });
  });

  it('rejects successful workflow with skipped, failed or incomplete deploy', () => {
    mustReject((x) => {
      x.jobs.jobs[0].conclusion = 'failure';
    });
    mustReject((x) => {
      x.jobs.jobs[0].conclusion = 'skipped';
    });
    mustReject((x) => {
      x.jobs.jobs[0].steps.pop();
    });
    mustReject((x) => {
      x.jobs.total_count = 2;
    });
    mustReject((x) => {
      x.jobs.jobs = [];
      x.jobs.total_count = 0;
    });
  });

  it('rejects stale active runtime and missing Worker version', () => {
    mustReject((x) => {
      x.runtime.buildId = SHA + '-1-2';
    });
    mustReject((x) => {
      x.runtime.workerVersion = '';
    });
  });

  it('rejects stale, noncanonical or redirected public pages', () => {
    mustReject((x) => {
      x.article.status = 404;
    });
    mustReject((x) => {
      x.article.url = 'https://evil.invalid';
    });
    mustReject((x) => {
      x.article.headers = 'HTTP/2 200\ncontent-type: text/html\n\n';
    });
    mustReject((x) => {
      x.article.html = '<link rel="canonical" href="https://evil.invalid">';
    });
    mustReject((x) => {
      x.article.html += x.article.html;
    });
    mustReject((x) => {
      x.slug = '../private';
    });
  });

  it('keeps manual preflight read-only with no token or dispatch authority', () => {
    const workflow = readFileSync(
      new URL(
        '../../.github/workflows/content-production-bridge-preflight.yml',
        import.meta.url
      ),
      'utf8'
    );
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain(
      'permissions:\n  contents: read\n  actions: read'
    );
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
