import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  assessFreshProductionCandidate,
  ProductionCandidateSupersededError,
} from './cloudflare-production-freshness.mjs';

export async function checkProductionSupersession({
  assess = assessFreshProductionCandidate,
  output = process.env.GITHUB_OUTPUT,
  summary = process.env.GITHUB_STEP_SUMMARY,
  candidateSha = process.env.CANDIDATE_SHA,
  source = process.env.CANDIDATE_SOURCE,
} = {}) {
  if (!output) throw new Error('GITHUB_OUTPUT is required');
  let status = 'current';
  try {
    await assess({
      configPath: 'apps/website/wrangler.production.jsonc',
      candidateSource: source,
      candidateSha,
    });
  } catch (error) {
    if (!(error instanceof ProductionCandidateSupersededError) || source !== 'staging') {
      throw error;
    }
    status = 'superseded';
    console.log('::notice::' + error.message);
    if (summary) {
      await appendFile(summary, `### Production candidate superseded (no deployment)\n\n${error.message}\n\nA newer staging-qualified promotion must own production.\n`);
    }
  }
  await appendFile(output, `superseded=${status === 'superseded'}\n`);
  return status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkProductionSupersession();
}
