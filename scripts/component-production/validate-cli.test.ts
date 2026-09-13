import { describe, expect, it } from 'vitest';

import type {
  ComponentProductionInputV1,
  ComponentProductionValidationResultV1,
} from './contracts';
import { runComponentProductionValidationCli } from './validate-cli';

const SPEC: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'both',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};

describe('runComponentProductionValidationCli', () => {
  it.each([
    ['--spec', 'safe.json', '--candidate-snapshot'],
    ['--spec', 'safe.json', '--candidate-snapshot', '--force'],
    [
      '--spec',
      'safe.json',
      '--candidate-snapshot',
      'a.json',
      '--candidate-snapshot',
      'b.json',
    ],
  ])('rejects missing or duplicate snapshot options: %s', async (...args) => {
    let called = false;
    const code = await runComponentProductionValidationCli(args, {
      runValidation: async () => {
        called = true;
        return validationResult('ready');
      },
      writeError: () => undefined,
    });
    expect(code).toBe(2);
    expect(called).toBe(false);
  });

  it.each([
    '{malformed',
    '{"schemaVersion":"2","baseRevision":"invalid","entries":[]}',
  ])(
    'rejects malformed snapshot before invoking validation',
    async (contents) => {
      let called = false;
      const errors: string[] = [];
      const code = await runComponentProductionValidationCli(
        [
          '--spec',
          'safe.json',
          '--candidate-snapshot',
          'snapshot with spaces.json',
        ],
        {
          readFile: (file) =>
            file.endsWith('safe.json') ? JSON.stringify(SPEC) : contents,
          runValidation: async () => {
            called = true;
            return validationResult('ready');
          },
          writeError: (value) => errors.push(value),
        }
      );
      expect(code).toBe(2);
      expect(called).toBe(false);
      expect(errors.join('')).toContain('snapshot with spaces.json');
    }
  );
  it('runs validation-only from an explicit JSON specification', async () => {
    const output: string[] = [];
    let observedInput: unknown;

    const exitCode = await runComponentProductionValidationCli(
      ['--spec', 'avatar.json'],
      {
        root: '/tmp/vellira-production',
        readFile: (filePath) => {
          expect(filePath).toBe('/tmp/vellira-production/avatar.json');

          return JSON.stringify(SPEC);
        },
        runValidation: async ({ root, input }) => {
          expect(root).toBe('/tmp/vellira-production');
          observedInput = input;

          return validationResult('ready');
        },
        write: (message) => {
          output.push(message);
        },
      }
    );

    expect(exitCode).toBe(0);
    expect(observedInput).toEqual(SPEC);

    expect(JSON.parse(output[0] ?? '')).toMatchObject({
      schemaVersion: '1',
      status: 'ready',
      readyForReview: true,
      validationSummary: {
        status: 'ready',
      },
    });
  });

  it('uses exit code 1 for deterministic validation blocking', async () => {
    const output: string[] = [];

    const exitCode = await runComponentProductionValidationCli(
      ['--spec', 'avatar.json'],
      {
        readFile: () => JSON.stringify(SPEC),
        runValidation: async () => validationResult('blocked'),
        write: (message) => output.push(message),
      }
    );

    expect(exitCode).toBe(1);

    expect(JSON.parse(output[0] ?? '')).toMatchObject({
      status: 'blocked',
      readyForReview: false,
      blockingFindings: [
        {
          id: 'tests:react-tests',
          stage: 'tests',
          severity: 'blocking',
        },
      ],
    });
  });

  it('uses exit code 2 for validation runtime failure', async () => {
    const exitCode = await runComponentProductionValidationCli(
      ['--spec', 'avatar.json'],
      {
        readFile: () => JSON.stringify(SPEC),
        runValidation: async () => validationResult('failed'),
        write: () => undefined,
      }
    );

    expect(exitCode).toBe(2);
  });

  it('emits machine-readable errors for malformed specifications', async () => {
    const errors: string[] = [];

    const exitCode = await runComponentProductionValidationCli(
      ['--spec', 'avatar.json'],
      {
        readFile: () => '{bad json',
        writeError: (message) => errors.push(message),
      }
    );

    expect(exitCode).toBe(2);

    expect(JSON.parse(errors[0] ?? '')).toMatchObject({
      schemaVersion: '1',
      status: 'error',
      error: {
        message: expect.stringContaining(
          'Unable to read component production specification'
        ),
      },
    });
  });

  it('rejects missing and unknown options', async () => {
    const errors: string[] = [];

    expect(
      await runComponentProductionValidationCli([], {
        writeError: (message) => errors.push(message),
      })
    ).toBe(2);

    expect(
      await runComponentProductionValidationCli(['--force'], {
        writeError: (message) => errors.push(message),
      })
    ).toBe(2);

    expect(errors.join('\n')).toContain(
      'component-production:validate:json --spec'
    );

    expect(errors.join('\n')).toContain(
      'Unknown component production validation option'
    );
  });
});

function validationResult(
  status: 'ready' | 'blocked' | 'failed'
): ComponentProductionValidationResultV1 {
  const finding =
    status === 'ready'
      ? []
      : [
          {
            id: 'tests:react-tests',
            stage: 'tests' as const,
            severity: 'blocking' as const,
            message: 'Avatar tests failed.',
          },
        ];

  return {
    schemaVersion: '1',
    input: SPEC,
    status,
    readyForReview: status === 'ready',
    lifecycle:
      status === 'ready'
        ? {
            current: 'ready-for-review',
            completed: [
              'scaffolded',
              'semantic-completion-required',
              'candidate',
              'validated',
            ],
            semanticCompletionRequired: false,
            readyForReview: true,
          }
        : status === 'blocked'
          ? {
              current: 'validated',
              completed: [
                'scaffolded',
                'semantic-completion-required',
                'candidate',
              ],
              semanticCompletionRequired: false,
              readyForReview: false,
            }
          : {
              current: 'candidate',
              completed: ['scaffolded', 'semantic-completion-required'],
              semanticCompletionRequired: false,
              readyForReview: false,
            },
    stages: [],
    blockingFindings: finding,
    validationSummary: {
      status,
      passedStages: [],
      blockedStages: status === 'blocked' ? ['tests'] : [],
      failedStages: status === 'failed' ? ['tests'] : [],
      skippedStages: [],
    },
    completeness: null,
    quality: null,
  };
}
