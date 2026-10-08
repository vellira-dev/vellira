import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

type Step = {
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
};
const workflow = parse(
  readFileSync('.github/workflows/release-candidate-proof.yml', 'utf8')
) as {
  permissions: Record<string, string>;
  jobs: Record<string, { steps: Step[] }>;
};

describe('exact candidate packages with current consumer proof tooling', () => {
  it.each(['vite', 'next', 'expo'])(
    'binds the %s harness to the workflow revision and packages to the candidate',
    (consumer) => {
      const steps = workflow.jobs[`${consumer}-consumer`].steps;
      expect(
        steps.find((step) => step.uses?.startsWith('actions/checkout@'))?.with
          ?.ref
      ).toBe('${{ github.sha }}');
      expect(
        steps.find((step) =>
          step.uses?.startsWith('actions/download-artifact@')
        )?.with?.name
      ).toBe(
        'npm-release-candidate-${{ needs.candidate.outputs.candidate_sha }}'
      );
      const proof = steps.find(
        (step) =>
          step.run === `node scripts/release-candidate/${consumer}-consumer.cjs`
      );
      expect(proof?.env?.VELLIRA_CONSUMER_HARNESS_SHA).toBe(
        '${{ github.sha }}'
      );
      expect(proof?.env?.VELLIRA_CANDIDATE_SHA).toBe(
        '${{ needs.candidate.outputs.candidate_sha }}'
      );
      expect(workflow.permissions).toEqual({ contents: 'read' });
    }
  );

  it('retains exact-head packing and candidate documentation checks', () => {
    expect(
      workflow.jobs.candidate.steps.find((step) =>
        step.uses?.startsWith('actions/checkout@')
      )?.with?.ref
    ).toBe('${{ github.event.pull_request.head.sha || github.sha }}');
    expect(
      workflow.jobs['docs-first-use'].steps.find((step) =>
        step.uses?.startsWith('actions/checkout@')
      )?.with?.ref
    ).toBe('${{ needs.candidate.outputs.candidate_sha }}');
  });
});
