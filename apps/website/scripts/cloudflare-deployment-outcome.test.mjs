import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ProductionCandidateSupersededError } from './cloudflare-production-freshness.mjs';
import {
  executeGuardedDeployment,
  recordDeploymentOutcome,
} from './cloudflare-deployment-outcome.mjs';

const CANDIDATE = 'a'.repeat(40);
const MAIN = 'b'.repeat(40);

function stale() {
  return new ProductionCandidateSupersededError('deployment-relevant main advance', {
    candidateSha: CANDIDATE,
    mainSha: MAIN,
    relevantPaths: ['apps/website/src/page.tsx'],
  });
}

function phases(overrides = {}) {
  const calls = [];
  const call = (name) => async () => {
    calls.push(name);
  };
  return {
    calls,
    steps: {
      candidateSource: 'staging',
      checkBeforeArchive: call('check-before-archive'),
      archive: call('archive-write'),
      dryRun: call('dry-run'),
      checkBeforeActivation: call('check-before-activation'),
      activate: call('worker-activation'),
      stabilize: call('runtime-stability'),
      ...overrides,
    },
  };
}

async function evidence(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vellira-deployment-outcome-'));
  try {
    const output = path.join(dir, 'outputs');
    const summary = path.join(dir, 'summary');
    return await run({ output, summary });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('healthy deployment retains its sequence and is reported as deployed', async () => {
  const { calls, steps } = phases();
  const result = await executeGuardedDeployment(steps);
  assert.equal(result.status, 'deployed');
  assert.deepEqual(calls, [
    'check-before-archive',
    'archive-write',
    'dry-run',
    'check-before-activation',
    'worker-activation',
    'runtime-stability',
  ]);
  await evidence(async ({ output, summary }) => {
    await recordDeploymentOutcome({
      outcome: result,
      output,
      summary,
      candidateSha: CANDIDATE,
    });
    assert.equal(
      await readFile(output, 'utf8'),
      'status=deployed\nsuperseded=false\ndeployed=true\n'
    );
  });
});

test('stale candidate before archive is a successful no-op with no R2 writes', async () => {
  const { calls, steps } = phases({
    checkBeforeArchive: async () => {
      throw stale();
    },
  });
  const result = await executeGuardedDeployment(steps);
  assert.equal(result.status, 'superseded');
  assert.equal(result.phase, 'before-archive');
  assert.equal(result.archiveWritesPossible, false);
  assert.deepEqual(calls, []);
  await evidence(async ({ output, summary }) => {
    await recordDeploymentOutcome({ outcome: result, output, summary });
    assert.equal(
      await readFile(output, 'utf8'),
      'status=superseded\nsuperseded=true\ndeployed=false\n'
    );
    const note = await readFile(summary, 'utf8');
    assert.match(note, /SUPERSEDED/);
    assert.match(note, /No R2 archive writes were attempted/);
    assert.match(note, new RegExp(CANDIDATE));
    assert.match(note, new RegExp(MAIN));
  });
});

test('stale candidate after archive never activates Worker and reports R2 side effects', async () => {
  const { calls, steps } = phases({
    checkBeforeActivation: async () => {
      throw stale();
    },
  });
  const result = await executeGuardedDeployment(steps);
  assert.equal(result.status, 'superseded');
  assert.equal(result.phase, 'before-worker-activation');
  assert.equal(result.archiveWritesPossible, true);
  assert.deepEqual(calls, ['check-before-archive', 'archive-write', 'dry-run']);
  await evidence(async ({ output, summary }) => {
    await recordDeploymentOutcome({ outcome: result, output, summary });
    assert.match(await readFile(output, 'utf8'), /deployed=false/);
    const note = await readFile(summary, 'utf8');
    assert.match(note, /Immutable R2 assets and an unused archive manifest may have been written/);
    assert.match(note, /Worker activation: \*\*not attempted\*\*/);
  });
});

test('GitHub API failures before or after archive remain failures, not no-ops', async () => {
  for (const phase of ['checkBeforeArchive', 'checkBeforeActivation']) {
    const { calls, steps } = phases({
      [phase]: async () => {
        throw new Error('GitHub API unreachable');
      },
    });
    await assert.rejects(executeGuardedDeployment(steps), /GitHub API unreachable/);
    assert.equal(calls.includes('worker-activation'), false);
  }
});

test('archive, dry-run, Worker upload and stabilization errors always fail closed', async () => {
  for (const phase of ['archive', 'dryRun', 'activate', 'stabilize']) {
    const { steps } = phases({
      [phase]: async () => {
        throw stale();
      },
    });
    await assert.rejects(
      executeGuardedDeployment(steps),
      ProductionCandidateSupersededError,
      phase
    );
  }
});

test('Cloudflare failures are not swallowed even when a candidate is current', async () => {
  const { steps } = phases({
    activate: async () => {
      throw new Error('Cloudflare Workers upload failed');
    },
  });
  await assert.rejects(
    executeGuardedDeployment(steps),
    /Cloudflare Workers upload failed/
  );
});

test('emergency recovery is never converted into a stale-candidate no-op', async () => {
  for (const phase of ['checkBeforeArchive', 'checkBeforeActivation']) {
    const { steps } = phases({
      candidateSource: 'emergency-recovery',
      [phase]: async () => {
        throw stale();
      },
    });
    await assert.rejects(
      executeGuardedDeployment(steps),
      ProductionCandidateSupersededError
    );
  }
});

test('invalid outcome must not emit success or no-op evidence', async () => {
  await evidence(async ({ output, summary }) => {
    await assert.rejects(
      recordDeploymentOutcome({
        outcome: { status: 'unknown' },
        output,
        summary,
      }),
      /unknown deployment outcome/
    );
    await assert.rejects(readFile(output), { code: 'ENOENT' });
  });
});
