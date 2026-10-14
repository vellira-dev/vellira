import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ProductionCandidateSupersededError } from './cloudflare-production-freshness.mjs';
import { checkProductionSupersession } from './cloudflare-production-supersession.mjs';

async function withOutput(testCase) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vellira-supersession-'));
  try {
    const output = path.join(dir, 'output');
    const summary = path.join(dir, 'summary');
    await testCase({ output, summary });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('superseded staging candidate is skipped with explicit evidence', async () => {
  await withOutput(async ({ output, summary }) => {
    const state = await checkProductionSupersession({
      source: 'staging',
      candidateSha: 'a'.repeat(40),
      output,
      summary,
      assess: async () => {
        throw new ProductionCandidateSupersededError('deployment-relevant main advance');
      },
    });
    assert.equal(state, 'superseded');
    assert.match(await readFile(output, 'utf8'), /^superseded=true/m);
    assert.match(await readFile(summary, 'utf8'), /no deployment/);
  });
});

test('fresh candidate retains deployment authority', async () => {
  await withOutput(async ({ output, summary }) => {
    const state = await checkProductionSupersession({
      source: 'staging',
      output,
      summary,
      assess: async () => ({ deploymentEquivalent: true }),
    });
    assert.equal(state, 'current');
    assert.match(await readFile(output, 'utf8'), /^superseded=false/m);
  });
});

test('API errors and unverified comparisons still fail closed', async () => {
  await withOutput(async ({ output, summary }) => {
    for (const source of ['staging', 'emergency-recovery']) {
      await assert.rejects(
        checkProductionSupersession({
          source,
          output,
          summary,
          assess: async () => {
            throw new Error('GitHub API failed');
          },
        }),
        /GitHub API failed/
      );
    }
    await assert.rejects(
      checkProductionSupersession({
        source: 'emergency-recovery',
        output,
        summary,
        assess: async () => {
          throw new ProductionCandidateSupersededError('unexpected');
        },
      }),
      /unexpected/
    );
  });
});

test('workflow gates postflight, IndexNow, and bridge on verified deployment', async () => {
  const workflow = await readFile(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/deploy-website-cloudflare-production.yml'
    ),
    'utf8'
  );
  const notifier = await readFile(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/content-production-distribution-notify.yml'
    ),
    'utf8'
  );
  assert.match(workflow, /id: preflight/);
  assert.match(workflow, /id: prepublish/);
  assert.ok(workflow.includes("steps.prepublish.outputs.superseded != 'true'"));
  assert.ok(
    workflow.includes(
      "steps.worker-deploy.outcome == 'success' && steps.worker-deploy.outputs.deployed == 'true' && steps.worker-deploy.outputs.status == 'deployed'"
    )
  );
  assert.ok(workflow.includes("needs.deploy.outputs.deployed == 'true'"));
  assert.ok(workflow.includes('id: premutation'));
  assert.ok(workflow.includes('node apps/website/scripts/cloudflare-production-supersession.mjs'));

  // A missing worker-deploy output must not allow any post-deploy verification.
  const postflightNames = [
    'Audit assets after OpenNext deploy cache population',
    'Smoke test production routes',
    'Smoke test production auth provider discovery',
    'Verify deployed identities, freshness and immutable bytes',
    'Test browser forensic diagnostics',
    'Verify production component explorer browser geometry',
    'Smoke test production navigation and actor metrics',
    'Soak test production client navigation static assets',
    'Smoke test production static chunk integrity',
  ];
  const steps = workflow.split('      - name: ');
  for (const name of [
    'Record production promotion provenance',
    'Deploy production website to Cloudflare Workers',
  ]) {
    const block = steps.find((step) => step.startsWith(name + '\n'));
    assert.ok(block, 'Missing gated mutation: ' + name);
    assert.ok(
      block.includes("steps.premutation.outputs.superseded != 'true'"),
      'Late stale mutation gate must deny: ' + name
    );
  }
  for (const name of postflightNames) {
    const block = steps.find((step) => step.startsWith(name + '\n'));
    assert.ok(block, 'Missing production postflight step: ' + name);
    assert.ok(
      block.includes("steps.worker-deploy.outputs.deployed == 'true'"),
      'Postflight must require positive deployment receipt: ' + name
    );
  }

  // The notifier does not mistake a green no-op for verified new content.
  assert.ok(notifier.includes('if matched is None:'));
  assert.ok(notifier.includes('Active Worker build belongs to another run'));
  assert.equal(
    notifier.split('      - name: Dispatch immutable deployment reference').length - 1,
    1,
    'Notifier must have exactly one immutable dispatch step'
  );
  assert.ok(notifier.includes('raise SystemExit(0)'));
  const runtimeGuard = notifier.indexOf("if ! grep -Eq '^candidate-sha=");
  const authorizeDispatch = notifier.indexOf("echo 'eligible=true'");
  assert.ok(runtimeGuard > 0);
  assert.ok(authorizeDispatch > runtimeGuard);
  assert.ok(notifier.includes("echo 'eligible=false' >>"));
  assert.ok(notifier.includes("if: steps.source.outputs.eligible == 'true'"));
});

test('terminal supersession uses phase-specific fail-closed orchestration', async () => {
  const deploy = await readFile(
    path.resolve(import.meta.dirname, './cloudflare-deploy.mjs'),
    'utf8'
  );
  assert.ok(deploy.includes('executeGuardedDeployment({'));
  assert.ok(deploy.includes('checkBeforeArchive:'));
  assert.ok(deploy.includes('checkBeforeActivation:'));
  assert.ok(deploy.includes("outcome.status === 'superseded'"));
  assert.ok(deploy.includes('recordDeploymentOutcome({'));
  assert.ok(deploy.includes("'.open-next/vellira-build.json'"));
});

test('notifier shell and embedded Python remain syntactically executable', async () => {
  const notifier = await readFile(
    path.resolve(
      import.meta.dirname,
      '../../../.github/workflows/content-production-distribution-notify.yml'
    ),
    'utf8'
  );
  const start = notifier.indexOf(
    '      - name: Recheck completed source run and exact successful deployment'
  );
  const end = notifier.indexOf(
    '      - name: Create short-lived repository-scoped private dispatch token',
    start
  );
  assert.ok(start >= 0 && end > start);
  const step = notifier.slice(start, end);
  const marker = '        run: |\n';
  const beginning = step.indexOf(marker);
  assert.ok(beginning >= 0);
  const script = step
    .slice(beginning + marker.length)
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
  const shell = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' });
  assert.equal(shell.status, 0, shell.stderr);

  const pythonStart = script.indexOf("python - <<'PY'\n");
  const pythonEnd = script.indexOf('\nPY\n', pythonStart);
  assert.ok(pythonStart >= 0 && pythonEnd > pythonStart);
  const python = script.slice(pythonStart + "python - <<'PY'\n".length, pythonEnd);
  const syntax = spawnSync(
    'python3',
    ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'],
    { input: python, encoding: 'utf8' }
  );
  assert.equal(syntax.status, 0, syntax.stderr);
});
