import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function effectiveJobCacheMode(source, jobName) {
  const lines = source.split('\n');
  let workflowMode = null;
  let inJobs = false;
  let inJob = false;

  for (const line of lines) {
    if (!inJobs) {
      if (line === 'jobs:') {
        inJobs = true;
        continue;
      }

      const workflowMatch = line.match(/^cache-mode:\s*(\S+)\s*$/);
      if (workflowMatch) workflowMode = workflowMatch[1];
      continue;
    }

    const jobMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch) {
      inJob = jobMatch[1] === jobName;
      continue;
    }

    if (!inJob) continue;

    const jobModeMatch = line.match(/^    cache-mode:\s*(\S+)\s*$/);
    if (jobModeMatch) return jobModeMatch[1];
  }

  return workflowMode;
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

test('required title check keeps exact-head metadata semantics with trusted authority', () => {
  const source = workflow('pr-title');
  const triggers = section(source, 'on');

  for (const event of ['opened', 'edited', 'reopened', 'synchronize']) {
    assert.ok(triggers.includes(event));
  }

  assert.doesNotMatch(triggers, /ready_for_review/);
  assert.match(source, /name: Validate PR title/);
  assert.match(
    source,
    /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/
  );
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /package-manager-cache: false/);
  assert.match(source, /Require adopted title-validator authority/);
  assert.match(
    source,
    /pnpm --filter @vellira-ci\/pr-title-validator\s+--config\.inject-workspace-packages=true\s+deploy --dev tools\/pr-title-validator-deploy/
  );
  assert.match(source, /working-directory: tools\/pr-title-validator-deploy/);
  assert.match(source, /pnpm run validate/);
  assert.match(source, /package_snapshots > 300/);
  assert.doesNotMatch(
    source,
    /--ignore-workspace|--lockfile-dir|mode=bootstrap|mode=isolated|pnpm dlx|npx |cache: pnpm|pull_request_target:|continue-on-error:|: write|secrets\./m
  );
  assert.equal(
    section(source, 'permissions').trim(),
    'contents: read\n  pull-requests: read'
  );
});

test('title validator deploy fails closed and bounds dependency expansion', () => {
  const source = workflow('pr-title');
  const authority = script(source, 'Require adopted title-validator authority');
  const bounded = script(source, 'Verify deployed validator stayed bounded');

  for (const file of [
    'tools/pr-title-validator/package.json',
    'tools/pr-title-validator/commitlint.config.js',
    'commitlint.config.js',
    'pnpm-lock.yaml',
  ]) {
    assert.ok(authority.includes(`test -f ${file}`));
  }

  assert.match(
    bounded,
    /test -x tools\/pr-title-validator-deploy\/node_modules\/\.bin\/commitlint/
  );
  assert.match(bounded, /tools\/pr-title-validator-deploy\/pnpm-lock\.yaml/);
  assert.match(bounded, /\^packages:\$/);
  assert.match(bounded, /\^snapshots:\$/);
  assert.match(bounded, /package_snapshots < 1 \\|\\| package_snapshots > 300/);
  assert.match(bounded, /exit 1/);
  assert.match(
    source,
    /--config\.inject-workspace-packages=true\s+deploy --dev tools\/pr-title-validator-deploy/
  );
  assert.doesNotMatch(
    source,
    /pnpm install|deploy --legacy|--ignore-workspace|--lockfile-dir|--config\.node-linker/
  );
});

test('minimal title validator reuses canonical config and locked root resolution', () => {
  const validator = JSON.parse(
    readFileSync(
      new URL('../../tools/pr-title-validator/package.json', import.meta.url),
      'utf8'
    )
  );
  const rootPackage = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  );
  const wrapper = readFileSync(
    new URL(
      '../../tools/pr-title-validator/commitlint.config.js',
      import.meta.url
    ),
    'utf8'
  );
  const lock = readFileSync(
    new URL('../../pnpm-lock.yaml', import.meta.url),
    'utf8'
  );

  assert.equal(validator.private, true);
  assert.equal(
    validator.scripts.validate,
    'commitlint --config commitlint.config.js'
  );
  assert.match(
    wrapper,
    /import canonicalConfig from '\.\.\/\.\.\/commitlint\.config\.js';/
  );
  assert.match(wrapper, /export default canonicalConfig;/);
  assert.doesNotMatch(wrapper, /extends:|rules:/);

  for (const dependency of [
    '@commitlint/cli',
    '@commitlint/config-conventional',
  ]) {
    const exact = validator.devDependencies[dependency];
    assert.ok(rootPackage.devDependencies[dependency].endsWith(exact));
  }

  const rootImporter = lock
    .split('\n  .:\n')[1]
    ?.split('\n  apps/docs:\n')[0];
  const validatorImporter = lock
    .split('\n  tools/pr-title-validator:\n')[1]
    ?.split('\n  packages/react:\n')[0];
  assert.ok(rootImporter, 'Missing root lock importer');
  assert.ok(validatorImporter, 'Missing locked PR-title validator importer');

  function resolvedVersion(importer, dependency) {
    const marker = `      '${dependency}':\n`;
    const section = importer.split(marker)[1];
    assert.ok(section, `Missing locked dependency: ${dependency}`);
    const versionLine = section
      .split('\n')
      .find((line) => line.trim().startsWith('version: '));
    assert.ok(versionLine, `Missing locked resolution: ${dependency}`);
    return versionLine.trim().slice('version: '.length);
  }

  assert.equal(
    resolvedVersion(validatorImporter, '@commitlint/cli'),
    resolvedVersion(rootImporter, '@commitlint/cli'),
    'Validator CLI resolution must equal root canonical resolution'
  );
  assert.equal(
    resolvedVersion(validatorImporter, '@commitlint/config-conventional'),
    resolvedVersion(rootImporter, '@commitlint/config-conventional'),
    'Validator conventional config resolution must equal root canonical resolution'
  );

  function lockedSpecifier(importer, dependency) {
    const markers = [
      `      '${dependency}':\n`,
      `      ${dependency}:\n`,
    ];
    const section = markers
      .map((marker) => importer.split(marker)[1])
      .find(Boolean);
    assert.ok(section, `Missing locked dependency: ${dependency}`);
    const specifierLine = section
      .split('\n')
      .find((line) => line.trim().startsWith('specifier: '));
    assert.ok(specifierLine, `Missing locked specifier: ${dependency}`);
    return specifierLine.trim().slice('specifier: '.length);
  }

  for (const dependency of [
    '@commitlint/cli',
    '@commitlint/config-conventional',
    '@types/node',
    'conventional-commits-parser',
    'typescript',
  ]) {
    assert.equal(
      lockedSpecifier(validatorImporter, dependency),
      validator.devDependencies[dependency],
      `Validator lock importer must preserve exact ${dependency} specifier`
    );
  }
});

test('minimal validator preserves canonical valid and invalid title outcomes', () => {
  const args = [
    '--filter',
    '@vellira-ci/pr-title-validator',
    'run',
    'validate',
  ];

  for (const title of [
    'ci: isolate pull request title dependencies',
    'fix(ci): preserve exact head title validation',
  ]) {
    const result = spawnSync('pnpm', args, {
      cwd: process.cwd(),
      input: title + '\n',
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }

  for (const title of [
    'Update pull request title validation',
    'feat(ci) missing conventional separator',
  ]) {
    const result = spawnSync('pnpm', args, {
      cwd: process.cwd(),
      input: title + '\n',
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.notEqual(result.status, 0, 'Invalid title unexpectedly passed: ' + title);
  }
});

test('ready transition does not rerun unchanged-SHA validation', () => {
  for (const name of ['ci', 'ci-performance-budget', 'pr-title']) {
    const triggers = section(workflow(name), 'on');
    assert.doesNotMatch(triggers, /ready_for_review/);
    assert.match(triggers, /opened/);
    assert.match(triggers, /synchronize/);
    assert.match(triggers, /reopened/);
  }

  const dependabot = section(workflow('dependabot-auto-merge-metadata'), 'on');
  assert.match(dependabot, /ready_for_review/);
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

test('production admission is read-only and standalone supersede workflow is removed', () => {
  assert.equal(
    existsSync(
      new URL(
        '../../.github/workflows/supersede-stale-production-promotions.yml',
        import.meta.url
      )
    ),
    false
  );

  const production = workflow('deploy-website-cloudflare-production');
  const header = production.split('\njobs:\n')[0];
  assert.doesNotMatch(header, /\nconcurrency:\n/);
  assert.match(production, /\n  admission:\n/);
  assert.match(production, /CURRENT_PRODUCTION_RUN_ID:/);
  assert.match(production, /EXPECTED_CANDIDATE_SHA:/);
  assert.match(production, /cloudflare-production-admission\.mjs/);
  assert.match(
    production,
    /group: deploy-worker-vellira-website-admission\n {6}cancel-in-progress: false/
  );
  assert.match(
    production,
    /group: deploy-worker-vellira-website\n {6}cancel-in-progress: false/
  );
  const admission = production.split('\n  admission:\n')[1].split('\n  deploy:\n')[0];
  assert.match(admission, /actions: read/);
  assert.doesNotMatch(admission, /actions: write|deployments: write|secrets\./);
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

test('diagnostics deny Actions cache access to selected candidate code', () => {
  const source = workflow('component-diagnostics');
  assert.equal(effectiveJobCacheMode(source, 'diagnose'), 'none');

  const variants = [
    ['omitted', source.replace('    cache-mode: none\n', ''), null],
    ['read', source.replace('    cache-mode: none\n', '    cache-mode: read\n'), 'read'],
    ['write', source.replace('    cache-mode: none\n', '    cache-mode: write\n'), 'write'],
    [
      'write-only',
      source.replace('    cache-mode: none\n', '    cache-mode: write-only\n'),
      'write-only',
    ],
    [
      'permissive job override',
      `cache-mode: none\n${source.replace(
        '    cache-mode: none\n',
        '    cache-mode: write\n'
      )}`,
      'write',
    ],
  ];

  for (const [label, variant, expected] of variants) {
    assert.equal(
      effectiveJobCacheMode(variant, 'diagnose'),
      expected,
      `Unexpected effective cache mode for ${label}`
    );
    assert.notEqual(
      effectiveJobCacheMode(variant, 'diagnose'),
      'none',
      `Unsafe cache variant unexpectedly remained isolated: ${label}`
    );
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
