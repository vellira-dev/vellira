import { expect, it, vi } from 'vitest';

import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  createComponentProductionResult,
  parseComponentProductionInput,
} from '../component-production/contracts';
import { runCanonicalGapCli } from './cli';
import type { CanonicalGapIssueClient } from './types';

it('plans a Component Production missing-token finding without mutation', async () => {
  let creates = 0;
  const client: CanonicalGapIssueClient = {
    async listManagedIssues() {
      return [];
    },
    async ensureLabels() {},
    async createIssue() {
      creates += 1;
      throw new Error('plan mode must not create');
    },
  };
  const output: string[] = [];
  const report = JSON.stringify(
    createComponentProductionResult({
      input: parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
      }),
      completeness: null,
      quality: null,
      stages: COMPONENT_PRODUCTION_STAGE_IDS.map((id) => ({
        id,
        status: id === 'preflight' ? 'blocked' : 'skipped',
        summary: 'preflight evidence',
        artifacts: [],
        findings:
          id === 'preflight'
            ? [
                {
                  id: 'preflight:1',
                  stage: 'preflight',
                  severity: 'blocking',
                  message:
                    'missing-design-token: path="semantic.motion.disclosure" component="Accordion" part="component" platform="react" — expected canonical token path in @vellira-ui/tokens',
                },
              ]
            : [],
      })),
    })
  );

  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--production-report', 'production.json'],
    {
      readFile: () => report,
      createClient: () => client,
      write: (message) => output.push(message),
    }
  );

  expect(exitCode).toBe(0);
  expect(creates).toBe(0);
  expect(JSON.parse(output[0])).toMatchObject({
    mode: 'plan',
    results: [
      {
        action: 'planned-create',
        kind: 'token',
        issue: null,
        routing: { status: 'planned' },
      },
    ],
  });
});

it('rejects an incomplete production report before any GitHub access', async () => {
  const createClient = vi.fn();
  const output = vi.fn();
  const exitCode = await runCanonicalGapCli(
    [
      '--repo',
      'vellira-dev/vellira',
      '--production-report',
      'production.json',
      '--apply',
    ],
    {
      token: 'test-token',
      readFile: () =>
        JSON.stringify({
          schemaVersion: '1',
          input: { componentName: 'Accordion' },
          blockingFindings: [],
        }),
      createClient,
      write: output,
      writeError: vi.fn(),
    }
  );
  expect(exitCode).toBe(2);
  expect(createClient).not.toHaveBeenCalled();
  expect(output).not.toHaveBeenCalled();
});
