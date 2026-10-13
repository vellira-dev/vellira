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

test('full-path public browser suites overlap without dropping affected-path coverage', () => {
  const ci = jobBlock('ci');
  const parallelStart = ci.indexOf('- name: Parallel public website browser regressions');
  const showcaseStart = ci.indexOf('- name: CodeShowcase browser regression');
  const blogStart = ci.indexOf('- name: Blog discovery browser regression');
  const accountStart = ci.indexOf('- name: Core account browser acceptance');
  assert.ok(parallelStart > 0 && showcaseStart > parallelStart);
  assert.ok(blogStart > showcaseStart && accountStart > blogStart);

  const full = ci.slice(parallelStart, showcaseStart);
  assert.match(full, /execution_path != 'affected'/);
  for (const suite of [
    'code-showcase-website-smoke.mjs',
    'vellira-ui-usage-website-smoke.mjs',
    'blog-discovery-website-smoke.mjs',
    'newsletter-website-smoke.mjs',
  ]) {
    assert.match(full, new RegExp(suite.replaceAll('.', '\\.')));
  }
  assert.match(full, /wait "\$showcase_pid" \|\| showcase_status=\$\?/);
  assert.match(full, /wait "\$blog_pid" \|\| blog_status=\$\?/);
  assert.match(full, /showcase_status != 0 \|\| blog_status != 0/);
  assert.match(full, /trap 'kill "\$server_pid"/);

  const affectedShowcase = ci.slice(showcaseStart, blogStart);
  assert.match(affectedShowcase, /execution_path == 'affected'/);
  assert.match(affectedShowcase, /code-showcase-website-smoke.mjs/);
  assert.match(affectedShowcase, /vellira-ui-usage-website-smoke.mjs/);
  const affectedBlog = ci.slice(blogStart, accountStart);
  assert.match(affectedBlog, /execution_path == 'affected'/);
  assert.match(affectedBlog, /blog-discovery-website-smoke.mjs/);
  assert.match(affectedBlog, /newsletter-website-smoke.mjs/);
  assert.match(ci.slice(accountStart), /name: Core account browser acceptance/);
});
