import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  findOpenIntentDuplicates,
  isAdmissionExemptPullRequest,
  isBotPullRequest,
  isManagedDeliveryPullRequest,
  parseChangeIntent,
  requiresChangeIntent,
  validatePullRequestChangeIntent,
} from './pr-change-intent.mjs';

const human = (overrides = {}) => ({
  number: 2000,
  created_at: '2026-10-08T20:00:00Z',
  body: '<!-- vellira-change-intent:v1:generated-consumer-readiness-gap -->',
  user: { login: 'maintainer', type: 'User' },
  ...overrides,
});

test('parses one stable lowercase kebab-case intent marker', () => {
  assert.deepEqual(
    parseChangeIntent(
      'before\n<!-- vellira-change-intent:v1:generated-consumer-readiness-gap -->\nafter'
    ),
    { kind: 'valid', id: 'generated-consumer-readiness-gap' }
  );
});

test('rejects placeholder, malformed and multiple markers', () => {
  assert.equal(
    parseChangeIntent('<!-- vellira-change-intent:v1:replace-me -->').kind,
    'invalid'
  );
  assert.equal(
    parseChangeIntent('<!-- vellira-change-intent:v1:Bad_ID -->').kind,
    'invalid'
  );
  assert.equal(
    parseChangeIntent(
      '<!-- vellira-change-intent:v1:first -->\n<!-- vellira-change-intent:v1:second -->'
    ).kind,
    'invalid'
  );
});

test('grandfathers unmarked legacy PRs but requires markers after adoption', () => {
  assert.equal(
    requiresChangeIntent(human({ created_at: '2026-10-08T19:59:59Z' })),
    false
  );
  assert.equal(requiresChangeIntent(human()), true);
  assert.deepEqual(
    validatePullRequestChangeIntent({
      pull: human({ created_at: '2026-10-08T19:59:59Z', body: '' }),
      openPullRequests: [],
    }),
    { ok: true, status: 'legacy-unmarked' }
  );
  assert.equal(
    validatePullRequestChangeIntent({
      pull: human({ body: '' }),
      openPullRequests: [],
    }).status,
    'missing'
  );
});

test('bot-owned delivery paths remain exempt from the human engineering marker', () => {
  const bot = human({
    body: '',
    user: { login: 'vellira-release-sync[bot]', type: 'Bot' },
  });
  assert.equal(isBotPullRequest(bot), true);
  assert.deepEqual(
    validatePullRequestChangeIntent({ pull: bot, openPullRequests: [] }),
    { ok: true, status: 'bot-exempt' }
  );
});

test('canonical managed delivery markers are exempt even when GitHub attributes the PR to a user', () => {
  const managed = human({
    body: [
      '<!-- vellira-component-expansion:proposal-avatar -->',
      '<!-- vellira-component-expansion-candidate:proposal-avatar:sha256 -->',
    ].join('\n'),
  });
  assert.equal(isBotPullRequest(managed), false);
  assert.equal(isManagedDeliveryPullRequest(managed), true);
  assert.equal(isAdmissionExemptPullRequest(managed), true);
  assert.deepEqual(
    validatePullRequestChangeIntent({ pull: managed, openPullRequests: [] }),
    { ok: true, status: 'managed-delivery-exempt' }
  );
});

test('rejects a second open PR with the same root change intent', () => {
  const duplicate = human({
    number: 1999,
    html_url: 'https://github.com/vellira-dev/vellira/pull/1999',
  });
  const result = validatePullRequestChangeIntent({
    pull: human(),
    openPullRequests: [human(), duplicate],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'duplicate');
  assert.deepEqual(
    result.duplicates.map((pull) => pull.number),
    [1999]
  );
  assert.match(result.reason, /Continue the existing PR/);
});

test('different root intents may coexist', () => {
  const other = human({
    number: 1998,
    body: '<!-- vellira-change-intent:v1:cloudflare-rsc-soak-recovery -->',
  });
  assert.deepEqual(
    findOpenIntentDuplicates({
      currentNumber: 2000,
      intentId: 'generated-consumer-readiness-gap',
      openPullRequests: [other],
    }),
    []
  );
  assert.equal(
    validatePullRequestChangeIntent({
      pull: human(),
      openPullRequests: [other],
    }).status,
    'admitted'
  );
});

test('trusted PR metadata workflow owns the read-only admission backstop', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/pr-title.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /id: trusted_authority/);
  assert.match(workflow, /test -f scripts\/ci\/pr-change-intent\.mjs/);
  assert.match(workflow, /change_intent_adopted=true/);
  assert.match(workflow, /name: Validate engineering change intent/);
  assert.match(
    workflow,
    /if: steps\.trusted_authority\.outputs\.change_intent_adopted == 'true'/
  );
  assert.match(
    workflow,
    /node scripts\/ci\/pr-change-intent\.mjs event/
  );
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(
    workflow,
    /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/
  );
  assert.match(
    workflow,
    /permissions:\n  contents: read\n  pull-requests: read/
  );
  assert.doesNotMatch(
    workflow,
    /pull_request_target:|contents: write|pull-requests: write|secrets\./
  );
});

test('repository entry points require creator-side intent preflight', () => {
  const agents = readFileSync(
    new URL('../../AGENTS.md', import.meta.url),
    'utf8'
  );
  const template = readFileSync(
    new URL('../../.github/PULL_REQUEST_TEMPLATE.md', import.meta.url),
    'utf8'
  );
  assert.match(agents, /Engineering change admission/);
  assert.match(agents, /engineering-change-admission\.md/);
  assert.match(agents, /Search open pull requests for the exact/i);
  assert.match(
    template,
    /vellira-change-intent:v1:replace-me/
  );
  assert.match(template, /root problem/i);
});
