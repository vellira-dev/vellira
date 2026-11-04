import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { BASELINE_CHECKS, classifyAdmission } from './release-sync-admission.mjs';

export function rulesetGrantsSafeAdmission(rule) {
  if (!rule || rule.name !== 'Protect Main' || rule.enforcement !== 'active' ||
    rule.target !== 'branch' || rule.source_type !== 'Repository' ||
    !rule.conditions?.ref_name?.include?.includes('~DEFAULT_BRANCH') ||
    (rule.bypass_actors ?? []).length !== 0 ||
    rule.current_user_can_bypass !== 'never') return false;
  const pr = rule.rules.find(x => x.type === 'pull_request');
  const statuses = rule.rules.find(x => x.type === 'required_status_checks')?.parameters;
  if (!pr || !statuses?.strict_required_status_checks_policy) return false;
  const required = new Set(statuses.required_status_checks?.map(x => x.context) ?? []);
  return [...BASELINE_CHECKS, 'Release Sync Admission'].every(x => required.has(x));
}

async function api(path, token) {
  const res = await fetch('https://api.github.com' + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vellira-release-sync-automerge'
    }
  });
  if (!res.ok) throw new Error('Cannot verify merge authority via GitHub: ' + res.status + ' ' + path);
  return res.json();
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const mode = process.env.SYNC_MODE;
  const prNo = Number(process.env.PR_NUMBER);
  const expectedHead = process.env.EXPECTED_HEAD;
  const version = process.env.EXPECTED_VERSION;
  assert.equal(repo, 'vellira-dev/vellira');
  assert.ok(token && Number.isInteger(prNo) && prNo > 0 && /^[a-f0-9]{40}$/.test(expectedHead));
  assert.ok(mode === 'release' || mode === 'starter');
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/);

  const base = '/repos/' + repo;
  const pr = await api(base + '/pulls/' + prNo, token);
  assert.equal(pr.state, 'open', 'PR is not open');
  assert.equal(pr.head.sha, expectedHead, 'Producer HEAD drift');
  assert.equal(pr.base.ref, 'main', 'Unexpected PR base');
  assert.equal(pr.user.login, 'vellira-release-sync[bot]', 'Untrusted PR author');
  const files = (await api(base + '/pulls/' + prNo + '/files?per_page=100', token))
    .map(x => x.filename);
  const policy = classifyAdmission(pr, files);
  assert.equal(policy.kind, mode, 'Unexpected PR shape for producer');
  if (mode === 'release') {
    assert.equal(pr.head.ref, 'chore/sync-release-' + version);
  } else {
    assert.equal(pr.title, 'chore(starter): sync Vellira to v' + version);
  }

  const refs = await api(base + '/rulesets?includes_parents=true', token);
  const active = refs.filter(r => r.name === 'Protect Main' && r.enforcement === 'active');
  assert.ok(active.length <= 1, 'Ambiguous Protect Main rulesets');
  const detail = active.length
    ? await api(base + '/rulesets/' + active[0].id, token) : null;
  if (!rulesetGrantsSafeAdmission(detail)) {
    console.log('::notice::Auto-merge DISABLED: active Protect Main ruleset lacks strict required Release Sync Admission, or has bypass authority.');
    return;
  }
  const refreshed = await api(base + '/pulls/' + prNo, token);
  assert.equal(refreshed.head.sha, expectedHead, 'PR head changed during authority proof');
  assert.equal(refreshed.base.sha, pr.base.sha, 'PR base changed during authority proof');
  if (refreshed.auto_merge) {
    console.log('Exact guarded auto-merge already enabled.');
    return;
  }
  execFileSync('gh', ['pr','merge',String(prNo),'--repo',repo,
    '--auto','--squash','--delete-branch'], {stdio:'inherit',env:{
      ...process.env,GH_TOKEN:token
    }});
  console.log('Guarded auto-merge requested; Release Sync Admission and baseline required checks govern GitHub execution.');
}

if (process.argv[1] && process.argv[1].endsWith('/release-sync-automerge.mjs')) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}
