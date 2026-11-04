import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const BASELINE_CHECKS = Object.freeze([
  'chromatic', 'Build, Test & Validate', 'Validate PR title', 'CodeQL',
  'Tooling & IndexNow Tests', 'Typecheck & API Contracts'
]);

export const STARTER_CHECKS = Object.freeze([
  'pin-contract', 'web-clean-room', 'expo-clean-room',
  'package-exact-proof', 'migration-preflight', 'pinned-patch',
  'Pack exact npm candidate', 'Quality & Component Quality',
  'Unit & Coverage Tests', 'Storybook & Browser Tests',
  'Component Page & Blog Tests', 'Cloudflare runtime contracts',
  'Cloudflare multi-deployment browser migration',
  'Lighthouse / Website', 'Lighthouse / Docs',
  'Analyze (actions)', 'Analyze (javascript-typescript)'
]);

const STARTER_FILES = new Set([
  'examples/workspace-starter/README.md',
  'examples/workspace-starter/native/package.json',
  'examples/workspace-starter/native/package-lock.json',
  'examples/workspace-starter/web/package.json',
  'examples/workspace-starter/web/package-lock.json'
]);

export function classifyAdmission(pr, files) {
  assert.ok(pr && Array.isArray(files), 'Missing exact PR and file evidence');
  const release = pr.title === 'chore(release): sync package versions' ||
    pr.head.ref.startsWith('chore/sync-release-') ||
    pr.user.login === 'vellira-release-sync[bot]';
  const starter = pr.head.ref === 'chore/workspace-starter-release-sync' ||
    pr.title.startsWith('chore(starter): sync Vellira to v');
  if (!release && !starter) return { kind: 'other', checks: [] };
  assert.equal(pr.user.login, 'vellira-release-sync[bot]', 'Untrusted sync PR author');
  assert.equal(pr.base.ref, 'main', 'Sync PR target must be main');
  assert.equal(pr.draft, false, 'Draft PR cannot gain merge admission');
  assert.ok(files.length > 0 && files.length <= 12, 'Unexpected sync file count');
  assert.equal(new Set(files).size, files.length, 'Duplicate PR file');
  if (starter) {
    assert.ok(/^chore\(starter\): sync Vellira to v\d+\.\d+\.\d+$/.test(pr.title),
      'Untrusted Starter PR title');
    assert.equal(pr.head.ref, 'chore/workspace-starter-release-sync');
    assert.ok(files.every(f => STARTER_FILES.has(f)), 'Starter PR expands changed surface');
    assert.ok(files.some(f => f.includes('/native/')), 'Starter sync must include Native pins');
  } else {
    assert.equal(pr.title, 'chore(release): sync package versions');
    assert.match(pr.head.ref, /^chore\/sync-release-\d+\.\d+\.\d+$/);
    assert.ok(files.every(f => f === 'package.json' ||
      /^packages\/(core|icons|react-native|react|tokens|types)\/package\.json$/.test(f) ||
      STARTER_FILES.has(f)), 'Release sync includes untrusted file');
  }
  const native = files.some(f => f.startsWith('examples/workspace-starter/native/'));
  const web = files.some(f => f.startsWith('examples/workspace-starter/web/'));
  if (native !== web) throw new Error('Atomic Starter sync must include both Web and Native');
  return {
    kind: starter ? 'starter' : 'release',
    checks: [...BASELINE_CHECKS, ...(native ? STARTER_CHECKS : [])]
  };
}

export function assessCheckRuns(runs, checks) {
  assert.ok(Array.isArray(runs) && Array.isArray(checks));
  const byName = new Map();
  for (const run of runs) {
    if (!checks.includes(run.name)) continue;
    const expectedApp = run.name === 'CodeQL' ? 'github-advanced-security' : 'github-actions';
    if (run.app?.slug !== expectedApp) continue;
    const old = byName.get(run.name);
    if (!old || new Date(run.started_at ?? run.created_at ?? 0).getTime() >
       new Date(old.started_at ?? old.created_at ?? 0).getTime() ||
       (run.started_at === old.started_at && Number(run.id) > Number(old.id))) {
      byName.set(run.name, run);
    }
  }
  const failed = [], pending = [];
  for (const name of checks) {
    const run = byName.get(name);
    if (!run || run.status !== 'completed') {
      pending.push(name);
    } else if (run.conclusion !== 'success') {
      failed.push(name + ': ' + String(run.conclusion));
    }
  }
  return { failed, pending, success: failed.length === 0 && pending.length === 0 };
}

async function api(url, token) {
  const res = await fetch('https://api.github.com' + url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vellira-release-sync-admission'
    }
  });
  if (!res.ok) throw new Error('GitHub read API failed ' + res.status + ': ' + url);
  return res.json();
}

async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const initial = event.pull_request;
  assert.ok(initial?.head?.sha && initial?.number, 'Expected pull_request event');
  const ownerRepo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  assert.ok(/^vellira-dev\/vellira$/.test(ownerRepo) && token, 'Missing repository/token');
  const base = '/repos/' + ownerRepo;
  const prNo = initial.number;
  const head = initial.head.sha;
  const pr = await api(base + '/pulls/' + prNo, token);
  const filesResponse = await api(base + '/pulls/' + prNo + '/files?per_page=100', token);
  const files = filesResponse.map(x => x.filename);
  const policy = classifyAdmission(pr, files);
  if (policy.kind === 'other') {
    console.log('Non-release PR: admission delegates to ordinary branch rules.');
    return;
  }
  assert.equal(pr.head.sha, head, 'Candidate HEAD changed before admission');
  if (policy.kind === 'release') {
    execFileSync('node', [
      'scripts/ci/release-sync-contract.mjs',
      '--base', pr.base.sha,
      '--head', head,
      '--verify'
    ], { stdio: 'inherit', env: {
      ...process.env,
      VELLIRA_PR_TITLE: pr.title,
      VELLIRA_PR_AUTHOR: pr.user.login,
      VELLIRA_PR_HEAD_REF: pr.head.ref
    }});
  } else {
    const data = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = data.version;
    assert.equal(pr.title, 'chore(starter): sync Vellira to v' + version);
    assert.equal(
      fs.readFileSync('examples/workspace-starter/README.md', 'utf8')
        .includes('Vellira ' + version + ' packages'), true,
      'Starter README version mismatch');
    execFileSync('node', ['scripts/sync-workspace-starter-versions.cjs',
      version, '--check'], { stdio: 'inherit' });
    execFileSync('node', ['scripts/sync-workspace-starter-lockfiles.cjs',
      '--check'], { stdio: 'inherit' });
  }
  const stopAt = Date.now() + 25 * 60_000;
  while (Date.now() < stopAt) {
    const latest = await api(base + '/pulls/' + prNo, token);
    assert.equal(latest.head.sha, head, 'Candidate HEAD changed during checks');
    assert.equal(latest.base.sha, pr.base.sha, 'PR base changed during checks');
    assert.equal(latest.state, 'open', 'PR no longer open');
    const report = await api(base + '/commits/' + head + '/check-runs?per_page=100', token);
    assert.ok(report.total_count <= 100, 'Truncated check-run evidence');
    const result = assessCheckRuns(report.check_runs, policy.checks);
    if (result.failed.length) {
      throw new Error('Release sync denied: ' + result.failed.join('; '));
    }
    if (result.success) {
      console.log('Release sync admitted for exact HEAD ' + head +
        ', verified checks: ' + policy.checks.join(', '));
      return;
    }
    console.log('Release sync waiting for: ' + result.pending.join(', '));
    await new Promise(resolve => setTimeout(resolve, 20_000));
  }
  throw new Error('Release sync denied: timed out waiting for exact-head security checks.');
}

if (process.argv[1] && process.argv[1].endsWith('/release-sync-admission.mjs')) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
