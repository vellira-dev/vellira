import { randomUUID } from 'node:crypto';
import process from 'node:process';

export function deploymentIdentity(env = process.env) {
  const id = env.VELLIRA_BUILD_ID?.trim();
  if (env.VELLIRA_DEPLOYABLE === '1') {
    if (!id || !/^[a-f0-9]{40}-[0-9]+-[0-9]+$/.test(id)) {
      throw new Error(
        'Deployable builds require VELLIRA_BUILD_ID=<exact SHA>-<run ID>-<attempt>'
      );
    }

    const prHeadSha = env.PR_HEAD_SHA?.trim();
    if (prHeadSha) {
      if (!/^[a-f0-9]{40}$/.test(prHeadSha))
        throw new Error('PR_HEAD_SHA must be a full Git SHA');
      if (!id.startsWith(`${prHeadSha}-`))
        throw new Error('Build identity does not match PR_HEAD_SHA');
    } else if (env.GITHUB_SHA && !id.startsWith(`${env.GITHUB_SHA}-`)) {
      throw new Error('Build identity does not match GITHUB_SHA');
    }

    if (env.GITHUB_RUN_ID && id.split('-')[1] !== env.GITHUB_RUN_ID)
      throw new Error('Build identity does not match GITHUB_RUN_ID');
    if (env.GITHUB_RUN_ATTEMPT && id.split('-')[2] !== env.GITHUB_RUN_ATTEMPT)
      throw new Error('Build identity does not match GITHUB_RUN_ATTEMPT');
    return id;
  }
  return id || `local-${randomUUID()}`;
}
