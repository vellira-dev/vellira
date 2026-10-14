import assert from 'node:assert/strict';
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

test('workflow gates activation and IndexNow on successful deployment', async () => {
  const source = await readFile(
    path.resolve(import.meta.dirname, '../../../.github/workflows/deploy-website-cloudflare-production.yml'),
    'utf8'
  );
  assert.match(source, /id: preflight/);
  assert.match(source, /id: prepublish/);
  assert.match(source, /steps\.prepublish\.outputs\.superseded != 'true'/);
  assert.match(source, /deployed: \$\{\{ steps\.worker-deploy\.outcome == 'success' \}\}/);
  assert.match(source, /needs\.deploy\.outputs\.deployed == 'true'/);
  assert.match(source, /cloudflare-production-freshness\.mjs apps\/website\/wrangler\.production\.jsonc/);
});


test('terminal supersession remains a no-op, never a verified deployment', async () => {
  const workflow = await readFile(path.resolve(import.meta.dirname, '../../../.github/workflows/deploy-website-cloudflare-production.yml'), 'utf8');
  const deploy = await readFile(path.resolve(import.meta.dirname, './cloudflare-deploy.mjs'), 'utf8');
  assert.match(workflow, /worker-deploy\\.outputs\\.superseded == 'false'/);
  assert.match(workflow, /steps\\.worker-deploy\\.outputs\\.superseded != 'true'/);
  assert.match(workflow, /needs\\.deploy\\.outputs\\.deployed == 'true'/);
  assert.match(deploy, /error instanceof ProductionCandidateSupersededError/);
  assert.match(deploy, /CANDIDATE_SOURCE !== 'staging'/);
  assert.match(deploy, /superseded=true/);
  assert.match(deploy, /No Cloudflare Worker activation occurred/);
});
