import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import YAML from 'yaml';
import {
  qualityCommands,
  runCandidateQuality,
} from './run-candidate-quality.mjs';

const recipe =
  'pnpm format:check && pnpm component-pages:check && pnpm component-pages:audit && pnpm check:component --all';
function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-quality-authority-')
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const create = (name) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    const git = (...args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    git('init', '-q');
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: { 'ci:quality': recipe } })
    );
    fs.writeFileSync(path.join(dir, 'source.txt'), name);
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-qm',
      name
    );
    return { dir, sha: git('rev-parse', 'HEAD') };
  };
  const candidate = create('candidate');
  const tooling = create('tooling');
  return {
    candidateRoot: candidate.dir,
    candidateSha: candidate.sha,
    toolingRoot: tooling.dir,
    toolingSha: tooling.sha,
  };
}

test('all candidate quality commands retain order, flags and cwd; only projection tools come from the verified harness', (t) => {
  const args = fixture(t);
  const calls = [];
  const result = runCandidateQuality({
    ...args,
    runner: (command, words, options) => {
      calls.push([command, words, options.cwd]);
      return { status: 0 };
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.evidence.status, 'passed');
  assert.equal(result.evidence.candidateSha, args.candidateSha);
  assert.equal(result.evidence.toolingSha, args.toolingSha);
  assert.notEqual(args.candidateSha, args.toolingSha);
  assert.deepEqual(calls[0], ['pnpm', ['format:check'], args.candidateRoot]);
  assert.deepEqual(calls[3], [
    'pnpm',
    ['check:component', '--all'],
    args.candidateRoot,
  ]);
  for (const [index, name] of [
    [1, 'check-component-pages.ts'],
    [2, 'audit-component-pages.ts'],
  ]) {
    assert.deepEqual(calls[index], [
      process.execPath,
      [
        '--import',
        path.join(args.toolingRoot, 'node_modules/tsx/dist/loader.mjs'),
        path.join(args.toolingRoot, 'scripts/generators/component-page', name),
      ],
      args.candidateRoot,
    ]);
  }
});

for (const script of [
  recipe + ' || true',
  recipe + '; true',
  recipe + ' && pnpm x > output',
  recipe.replace('pnpm format:check', 'pnpm $(echo x)'),
  recipe.replace(
    'pnpm component-pages:check',
    'pnpm component-pages:check --fix'
  ),
  recipe.replace('pnpm component-pages:check && ', ''),
  recipe + ' && pnpm component-pages:check',
]) {
  test(`ambiguous or weakened quality recipe fails closed: ${script}`, (t) => {
    const args = fixture(t);
    fs.writeFileSync(
      path.join(args.candidateRoot, 'package.json'),
      JSON.stringify({ scripts: { 'ci:quality': script } })
    );
    assert.throws(() => qualityCommands(args.candidateRoot, args.toolingRoot));
  });
}

test('candidate command failure remains failed and later checks do not execute', (t) => {
  const args = fixture(t);
  let calls = 0;
  const result = runCandidateQuality({
    ...args,
    runner: () => {
      calls++;
      return { status: 7 };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.exitCode, 7);
  assert.equal(result.evidence.status, 'failed');
});

for (const side of ['candidate', 'tooling']) {
  test(`${side} revision drift is rejected before execution`, (t) => {
    const args = fixture(t);
    args[`${side}Sha`] = 'f'.repeat(40);
    assert.throws(
      () =>
        runCandidateQuality({
          ...args,
          runner: () => assert.fail('must not execute'),
        }),
      /revision/
    );
  });
  test(`${side} source mutation cannot report successful quality`, (t) => {
    const args = fixture(t);
    assert.throws(
      () =>
        runCandidateQuality({
          ...args,
          runner: () => {
            fs.writeFileSync(
              path.join(args[`${side}Root`], 'source.txt'),
              'changed'
            );
            return { status: 0 };
          },
        }),
      /uncommitted/
    );
  });
  test(`${side} untracked source cannot contaminate validation`, (t) => {
    const args = fixture(t);
    fs.writeFileSync(path.join(args[`${side}Root`], 'extra.ts'), 'extra');
    assert.throws(
      () =>
        runCandidateQuality({
          ...args,
          runner: () => assert.fail('must not execute'),
        }),
      /uncommitted/
    );
  });
}

test('workflow keeps candidate checkout, quality enforcement, tooling identity and artifact paths distinct', () => {
  const workflow = YAML.parse(
    fs.readFileSync('.github/workflows/ci.yml', 'utf8')
  );
  const job = workflow.jobs.quality;
  assert.equal(job.defaults.run['working-directory'], 'candidate');
  assert.equal(job.env.COMPONENT_QUALITY_ENFORCEMENT, 'blocking');
  const checkouts = job.steps.filter((step) =>
    step.uses?.startsWith('actions/checkout@')
  );
  assert.equal(checkouts.length, 2);
  assert.equal(checkouts[0].with.path, 'candidate');
  assert.equal(
    checkouts[0].with.ref,
    '${{ github.event.pull_request.head.sha || github.sha }}'
  );
  assert.equal(checkouts[1].with.path, 'quality-tools');
  assert.equal(checkouts[1].with.ref, '${{ github.sha }}');
  const check = job.steps.find((step) => step.name === 'Quality checks');
  assert.equal(check.env.VELLIRA_CANDIDATE_SHA, checkouts[0].with.ref);
  assert.equal(check.env.VELLIRA_CI_TOOLING_SHA, checkouts[1].with.ref);
  assert.match(
    check.run,
    /quality-tools\/scripts\/ci\/run-candidate-quality.mjs/
  );
  for (const step of job.steps.filter((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )) {
    assert.ok(step.with.path.startsWith('candidate/.artifacts/'));
  }
  const runtime = workflow.jobs['cloudflare-runtime-contracts'];
  assert.equal(runtime.env.VELLIRA_CANDIDATE_SHA, checkouts[0].with.ref);
  assert.equal(runtime.env.VELLIRA_CI_TOOLING_SHA, checkouts[1].with.ref);
  const loader = runtime.steps.find(
    (step) =>
      step.name === 'Load source-check profile from exact workflow revision'
  );
  assert.match(
    loader.run,
    /git show "\$VELLIRA_CI_TOOLING_SHA:scripts\/ci\/cloudflare-candidate-checks.mjs"/
  );
  const lint = runtime.steps.find(
    (step) => step.name === 'Lint deployment and diagnostic scripts'
  ).run;
  assert.match(lint, /cloudflare-candidate-checks.mjs" lint$/);
  const policies = runtime.steps.find(
    (step) => step.name === 'Test website smoke policies'
  );
  assert.match(policies.run, /cloudflare-candidate-checks.mjs" test$/);
});
