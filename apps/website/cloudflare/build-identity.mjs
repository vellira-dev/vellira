import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

function buildSource(env) {
  // Direct builds (including staging and PR runtime checks) retain their
  // existing GITHUB_SHA contract. A workflow_run must not silently fall back
  // to the control workflow's default-branch SHA when candidate data is absent.
  if (
    env.CANDIDATE_SOURCE === undefined &&
    env.GITHUB_EVENT_NAME !== 'workflow_run'
  ) {
    return { sha: env.GITHUB_SHA, label: 'GITHUB_SHA' };
  }

  const staged =
    env.CANDIDATE_SOURCE === 'staging' &&
    env.GITHUB_EVENT_NAME === 'workflow_run';
  const recovery =
    env.CANDIDATE_SOURCE === 'emergency-recovery' &&
    env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if (!staged && !recovery) {
    throw new Error(
      'Build identity requires a recognized production candidate source and event'
    );
  }
  if (!/^[a-f0-9]{40}$/.test(env.CANDIDATE_SHA ?? '')) {
    throw new Error('Build identity requires an exact CANDIDATE_SHA');
  }
  if (!env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT) {
    throw new Error(
      'Production build identity requires GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT'
    );
  }

  // CANDIDATE_SHA comes from the existing qualification job, not a new source
  // selector. Bind it to this module's checkout, never the caller's cwd or a
  // GIT_DIR override. This is an identity check, not deployment authorization:
  // staging evidence, human approval and freshness remain separate gates.
  const checkoutSha = execFileSync(
    'git',
    ['rev-parse', '--verify', 'HEAD^{commit}'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([name]) => !name.startsWith('GIT_')
        )
      ),
    }
  ).trim();
  if (checkoutSha !== env.CANDIDATE_SHA) {
    throw new Error(
      'Build identity candidate does not match checked-out HEAD'
    );
  }
  return { sha: env.CANDIDATE_SHA, label: 'CANDIDATE_SHA' };
}

export function deploymentIdentity(env = process.env) {
  const id = env.VELLIRA_BUILD_ID?.trim();
  if (env.VELLIRA_DEPLOYABLE === '1') {
    if (!id || !/^[a-f0-9]{40}-[0-9]+-[0-9]+$/.test(id)) {
      throw new Error(
        'Deployable builds require VELLIRA_BUILD_ID=<exact SHA>-<run ID>-<attempt>'
      );
    }
    const source = buildSource(env);
    if (source.sha && !id.startsWith(`${source.sha}-`))
      throw new Error(`Build identity does not match ${source.label}`);
    if (env.GITHUB_RUN_ID && id.split('-')[1] !== env.GITHUB_RUN_ID)
      throw new Error('Build identity does not match GITHUB_RUN_ID');
    if (
      env.GITHUB_RUN_ATTEMPT &&
      id.split('-')[2] !== env.GITHUB_RUN_ATTEMPT
    )
      throw new Error('Build identity does not match GITHUB_RUN_ATTEMPT');
    return id;
  }
  return id || `local-${randomUUID()}`;
}
