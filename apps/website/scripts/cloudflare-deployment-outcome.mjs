import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';

import { ProductionCandidateSupersededError } from './cloudflare-production-freshness.mjs';

// Only freshness checks can produce a non-failing supersession. In particular,
// an archive, Wrangler, or post-activation failure is NEVER classified as a
// successful skip, even if it uses the same error class accidentally.
export async function executeGuardedDeployment({
  candidateSource,
  checkBeforeArchive,
  archive,
  dryRun,
  checkBeforeActivation,
  activate,
  stabilize,
}) {
  async function checkFreshness(check, phase, archiveWritesPossible) {
    try {
      await check();
      return null;
    } catch (error) {
      if (
        candidateSource !== 'staging' ||
        !(error instanceof ProductionCandidateSupersededError)
      ) {
        throw error;
      }
      return {
        status: 'superseded',
        phase,
        archiveWritesPossible,
        error,
      };
    }
  }

  const early = await checkFreshness(checkBeforeArchive, 'before-archive', false);
  if (early) return early;

  // Archive writes are immutable and create-only. They are NOT Worker
  // activation; if main advances during this work, a superseded candidate may
  // leave unused assets and a deployment manifest in R2.
  await archive();
  await dryRun();

  const terminal = await checkFreshness(
    checkBeforeActivation,
    'before-worker-activation',
    true
  );
  if (terminal) return terminal;

  await activate();
  await stabilize();
  return { status: 'deployed', phase: 'verified', archiveWritesPossible: true };
}

export async function recordDeploymentOutcome({
  outcome,
  output = process.env.GITHUB_OUTPUT,
  summary = process.env.GITHUB_STEP_SUMMARY,
  candidateSha = process.env.CANDIDATE_SHA,
}) {
  assert.ok(
    outcome?.status === 'deployed' || outcome?.status === 'superseded',
    'Cannot record an unknown deployment outcome'
  );
  const superseded = outcome.status === 'superseded';
  if (superseded) {
    const message = String(outcome.error?.message ?? 'Candidate no longer current')
      .replaceAll('\n', ' ');
    console.log('::notice::SUPERSEDED — ' + message);
    if (summary) {
      const mainSha = outcome.error?.mainSha ?? 'unavailable';
      const candidate = outcome.error?.candidateSha ?? candidateSha ?? 'unavailable';
      const archiveState = outcome.archiveWritesPossible
        ? 'Immutable R2 assets and an unused archive manifest may have been written; no Worker activation occurred.'
        : 'No R2 archive writes were attempted in this deployment step.';
      await appendFile(
        summary,
        [
          '### Production: SUPERSEDED — deployment safely skipped',
          '',
          `- Candidate: \`${candidate}\``,
          `- Current main: \`${mainSha}\``,
          `- Phase: \`${outcome.phase}\``,
          `- R2 archive: ${archiveState}`,
          '- Worker activation: **not attempted**',
          '- IndexNow and production content dispatch: **not authorized**',
          '- Next: a newer successful main staging run triggers its own production promotion.',
          '',
          `Reason: ${message}`,
          '',
        ].join('\n')
      );
    }
  }
  // Emit only after the orchestration completed or returned a trusted skip.
  // Any exception before here means an actual FAILURE with no positive receipt.
  if (output) {
    await appendFile(
      output,
      `status=${outcome.status}\nsuperseded=${superseded}\ndeployed=${!superseded}\n`
    );
  }
  return outcome.status;
}
