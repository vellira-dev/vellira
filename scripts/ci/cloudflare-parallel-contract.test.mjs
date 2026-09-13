import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf8');
const budget = JSON.parse(
  await fs.readFile('.github/ci-performance-budget.json', 'utf8')
);

function jobBlock(jobId, nextJobId) {
  const start = workflow.indexOf(`\n  ${jobId}:\n`);
  assert.notEqual(start, -1, `Missing CI job: ${jobId}`);
  const end = nextJobId
    ? workflow.indexOf(`\n  ${nextJobId}:\n`, start + 1)
    : workflow.length;
  assert.notEqual(end, -1, `Missing following CI job: ${nextJobId}`);
  return workflow.slice(start, end);
}

test('Cloudflare runtime and migration contracts stay parallel behind the stable fan-in gate', () => {
  const runtime = jobBlock(
    'cloudflare-runtime-contracts',
    'cloudflare-browser-migration'
  );
  const migration = jobBlock(
    'cloudflare-browser-migration',
    'cloudflare-cache-migration'
  );
  const gate = jobBlock('cloudflare-cache-migration', 'typecheck');

  assert.match(runtime, /name: Cloudflare runtime contracts/);
  assert.match(runtime, /pnpm test:cloudflare-cache/);
  assert.match(runtime, /pnpm --dir apps\/website run build:opennext/);
  assert.doesNotMatch(runtime, /pnpm test:cloudflare-migration/);

  assert.match(migration, /name: Cloudflare multi-deployment browser migration/);
  assert.match(migration, /pnpm test:cloudflare-migration/);
  assert.doesNotMatch(migration, /build:opennext/);

  assert.match(
    gate,
    /name: Cloudflare cache and multi-deployment browser contracts/
  );
  assert.match(gate, /- cloudflare-runtime-contracts/);
  assert.match(gate, /- cloudflare-browser-migration/);
  assert.match(gate, /RUNTIME_RESULT/);
  assert.match(gate, /MIGRATION_RESULT/);
  assert.match(gate, /runtime=\$RUNTIME_RESULT migration=\$MIGRATION_RESULT/);
});

test('CI performance inventory measures both Cloudflare worker lanes and the stable gate', () => {
  const jobs = new Set(budget.workflow.requiredJobs);
  assert.ok(jobs.has('Cloudflare runtime contracts'));
  assert.ok(jobs.has('Cloudflare multi-deployment browser migration'));
  assert.ok(jobs.has('Cloudflare cache and multi-deployment browser contracts'));
});
