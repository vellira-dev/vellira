import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

// These probes exercise POSIX workflow steps; static contracts also run on Windows.
const shellTest = process.platform === 'win32' ? test.skip : test;

const workflow = (name) =>
  readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8');

function section(source, key) {
  const match = source.match(new RegExp(`^${key}:\\n([\\s\\S]*?)(?=^\\S|$(?![\\s\\S]))`, 'm'));
  assert.ok(match, `Missing workflow section: ${key}`);
  return match[1];
}

function script(source, name) {
  const step = source.split(`      - name: ${name}\n`)[1];
  assert.ok(step, `Missing step: ${name}`);
  const body = step.split('        run: |\n')[1];
  assert.ok(body, `Missing shell body: ${name}`);
  const lines = [];
  for (const line of body.split('\n')) {
    if (line.length && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  return lines.join('\n');
}

function sandbox(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'vellira-workflow-contract-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function shell(source, cwd, env = {}) {
  return spawnSync('bash', ['-c', source], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 5000,
  });
}

for (const [name, group] of [
  ['chromatic', 'chromatic-pr'],
  ['lighthouse', 'lighthouse-pr'],
  ['pr-title', 'pr-title'],
]) {
  test(`${name} supersedes only same-PR attempts and preserves non-PR runs`, () => {
    const concurrency = section(workflow(name), 'concurrency');
    assert.ok(concurrency.includes(`group: ${group}-`));
    assert.ok(concurrency.includes('${{ github.event.pull_request.number || github.run_id }}'));
    assert.ok(concurrency.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
    assert.doesNotMatch(concurrency, /github\.ref|cancel-in-progress: true/);
  });
}

test('required title check stays on synchronize and retains canonical commitlint', () => {
  const source = workflow('pr-title');
  for (const event of ['opened', 'edited', 'reopened', 'synchronize', 'ready_for_review']) {
    assert.ok(section(source, 'on').includes(event));
  }
  assert.match(source, /name: Validate PR title/);
  assert.match(source, /pnpm install --frozen-lockfile/);
  assert.match(source, /pnpm exec commitlint/);
  assert.doesNotMatch(source, /pull_request_target:|continue-on-error:/);
});

test('token report is manual only and retains its artifact and test paths', () => {
  const source = workflow('token-semantic-audit');
  assert.equal(section(source, 'on').trim(), 'workflow_dispatch:');
  assert.match(source, /pnpm --silent check:tokens-semantic:json/);
  assert.match(source, /scripts\/checks\/token-semantic/);
  assert.match(source, /if-no-files-found: error/);
});

test('docs deploy no longer triggers on PRs but keeps main and manual deployment', () => {
  const source = workflow('deploy-docs-worker');
  const triggers = section(source, 'on');
  assert.doesNotMatch(triggers, /pull_request/);
  assert.match(triggers, /push:\n {4}branches: \[main\]/);
  assert.match(triggers, /workflow_dispatch:/);
  assert.match(source, /pnpm exec turbo run build --filter='@vellira-ui\/docs\^\.\.\.'/);
  assert.match(source, /pnpm docs:build/);
  assert.match(source, /test -f "\$DOCS_DIST_DIR\/index\.html"/);
  assert.match(source, /pnpm exec wrangler deploy/);
});

test('Lighthouse retains the clean-checkout deployment build in dependency order', () => {
  const source = workflow('lighthouse').split('\n  website:\n')[0];
  const steps = [
    'pnpm install --frozen-lockfile',
    'Verify clean-checkout regression precondition',
    "pnpm exec turbo run build --filter='@vellira-ui/docs^...'",
    'pnpm docs:build',
    'test -f apps/docs/src/.vitepress/dist/index.html',
    'pnpm lighthouse:docs',
  ];
  let previous = -1;
  for (const step of steps) {
    const index = source.indexOf(step);
    assert.ok(index > previous, `Missing or reordered docs check: ${step}`);
    previous = index;
  }
  assert.doesNotMatch(source, /continue-on-error:/);
});

shellTest('clean-checkout probe rejects workspace dist but ignores dependency dist', (t) => {
  const cwd = sandbox(t);
  mkdirSync(path.join(cwd, 'apps'), { recursive: true });
  mkdirSync(path.join(cwd, 'packages/ui/node_modules/fixture/dist'), { recursive: true });
  const probe = script(workflow('lighthouse'), 'Verify clean-checkout regression precondition');
  assert.equal(shell(probe, cwd).status, 0);
  mkdirSync(path.join(cwd, 'packages/ui/dist'));
  assert.equal(shell(probe, cwd).status, 1);
});

test('supersession preserves queue-admission and rerun coverage until deduplication is proven', () => {
  const triggers = section(workflow('supersede-stale-production-promotions'), 'on');
  assert.match(triggers, /push:\n {4}branches: \[main\]/);
  assert.match(triggers, /types: \[requested, in_progress\]/);
});

test('IndexNow automatic path is downstream of verified production, not status events', () => {
  const manual = workflow('indexnow');
  assert.equal(section(manual, 'on').trim(), 'workflow_dispatch:');
  assert.doesNotMatch(manual, /deployment_status/);
  const source = workflow('deploy-website-cloudflare-production');
  const deploy = source.split('\n  deploy:\n')[1].split('\n  indexnow:\n')[0];
  const notify = source.split('\n  indexnow:\n')[1];
  assert.ok(notify);
  assert.match(deploy, /environment:\n {6}name: production/);
  assert.doesNotMatch(deploy, /continue-on-error:/);
  assert.match(notify, /needs: \[candidate, deploy\]/);
  assert.match(notify, /if: needs\.deploy\.result == 'success'/);
  assert.match(notify, /CANDIDATE_SHA: \$\{\{ needs\.candidate\.outputs\.candidate_sha \}\}/);
  assert.match(notify, /ref: \$\{\{ env\.CANDIDATE_SHA \}\}/);
  assert.match(notify, /persist-credentials: false/);
  assert.match(notify, /test "\$\(git rev-parse HEAD\)" = "\$CANDIDATE_SHA"/);
  assert.match(notify, /run: node scripts\/submit-indexnow\.mjs/);
  assert.doesNotMatch(notify, /secrets\.|environment:|: write/);
});

shellTest('notification failure is reported explicitly without another deployment', (t) => {
  const cwd = sandbox(t);
  const summary = path.join(cwd, 'summary.md');
  const source = script(workflow('deploy-website-cloudflare-production'), 'Record IndexNow outcome');
  for (const outcome of ['success', 'failure', 'skipped']) {
    writeFileSync(summary, '');
    const result = shell(source, cwd, {
      CANDIDATE_SHA: 'a'.repeat(40),
      INDEXNOW_OUTCOME: outcome,
      GITHUB_STEP_SUMMARY: summary,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(readFileSync(summary, 'utf8').includes(`**${outcome}**`));
    assert.equal(result.stdout.includes('::warning::'), outcome !== 'success');
  }
});

test('diagnostics are manual, fixed-profile and read-only with exact revision evidence', () => {
  const source = workflow('component-diagnostics');
  const triggers = section(source, 'on');
  assert.match(triggers, /workflow_dispatch:/);
  assert.doesNotMatch(triggers, /pull_request:|push:|schedule:|workflow_run:/);
  assert.equal(section(source, 'permissions').trim(), 'contents: read');
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /test "\$\(git rev-parse HEAD\)" = "\$DIAGNOSTIC_REVISION"/);
  assert.match(source, /always\(\) && steps\.identity\.outcome == 'success'/);
  assert.match(source, /retention-days: 14/);
  assert.doesNotMatch(source, /secrets\.|: write|environment:|continue-on-error:|eval /);
  assert.ok(source.indexOf('Validate immutable diagnostics inputs') < source.indexOf('uses: actions/checkout'));
});

shellTest('diagnostics reject mutable refs, malformed SHAs and arbitrary commands', (t) => {
  const cwd = sandbox(t);
  const source = script(workflow('component-diagnostics'), 'Validate immutable diagnostics inputs');
  const exact = 'a'.repeat(40);
  for (const revision of ['', 'main', 'refs/heads/main', 'abc123', 'A'.repeat(40), `${exact}\n`, '$(exit 0)']) {
    assert.equal(shell(source, cwd, { DIAGNOSTIC_REVISION: revision, DIAGNOSTIC_PROFILE: 'tooling' }).status, 2);
  }
  for (const profile of ['', 'arbitrary', 'tooling; exit 0', '$(exit 0)']) {
    assert.equal(shell(source, cwd, { DIAGNOSTIC_REVISION: exact, DIAGNOSTIC_PROFILE: profile }).status, 2);
  }
  for (const profile of ['component-production', 'component-quality', 'token-semantic', 'tooling']) {
    assert.equal(shell(source, cwd, { DIAGNOSTIC_REVISION: exact, DIAGNOSTIC_PROFILE: profile }).status, 0);
  }
});

shellTest('diagnostics execute only the selected canonical command and preserve failure through tee', (t) => {
  const cwd = sandbox(t);
  const bin = path.join(cwd, 'bin');
  mkdirSync(bin);
  mkdirSync(path.join(cwd, 'vellira-diagnostics'));
  writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nprintf "%s\\n" "$*"\nexit "${PROBE_EXIT_CODE:-0}"\n', { mode: 0o755 });
  const source = script(workflow('component-diagnostics'), 'Run selected repository diagnostics');
  const commands = {
    'component-production': 'exec vitest run --config vitest.tooling.config.ts scripts/component-production scripts/generators/component',
    'component-quality': 'check:component-quality --all',
    'token-semantic': 'check:tokens-semantic:strict',
    tooling: 'test:tooling',
  };
  for (const [profile, command] of Object.entries(commands)) {
    const env = { PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: cwd, DIAGNOSTIC_PROFILE: profile };
    const success = shell(source, cwd, { ...env, PROBE_EXIT_CODE: '0' });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(success.stdout.trim(), command);
    const failure = shell(source, cwd, { ...env, PROBE_EXIT_CODE: '17' });
    assert.equal(failure.status, 17, failure.stderr);
    assert.equal(readFileSync(path.join(cwd, 'vellira-diagnostics/output.log'), 'utf8').trim(), command);
  }
});
