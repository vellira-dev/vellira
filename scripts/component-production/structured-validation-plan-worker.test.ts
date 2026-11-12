import * as childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ComponentProductionInputV1 } from './contracts';
import {
  runComponentProductionPlanContractWorker,
  runComponentProductionStructuredValidation,
} from './structured-validation';
import { COMPONENT_PRODUCTION_PLAN_WORKER_SCHEMA_VERSION } from './structured-validation-protocol';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: vi.fn(),
}));

const root = '/tmp/plan worker candidate';
const input: ComponentProductionInputV1 = {
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
const reply = (driftedFiles: unknown = []) => ({
  schemaVersion: COMPONENT_PRODUCTION_PLAN_WORKER_SCHEMA_VERSION,
  componentName: input.componentName,
  driftedFiles,
});
const success = (value: unknown) =>
  ({
    pid: 123,
    status: 0,
    signal: null,
    output: [],
    stdout: JSON.stringify(value),
    stderr: '',
  }) as childProcess.SpawnSyncReturns<string>;

afterEach(() => vi.mocked(childProcess.spawnSync).mockReset());

describe('short-lived generated plan contract worker', () => {
  it('checks the full input with pinned validator code, candidate cwd and bounded stdin transport', () => {
    const spawn = vi
      .mocked(childProcess.spawnSync)
      .mockReturnValue(success(reply()));
    expect(runComponentProductionPlanContractWorker({ root, input })).toEqual(
      []
    );
    const toolsRoot = fileURLToPath(new URL('../../', import.meta.url));
    expect(spawn).toHaveBeenCalledExactlyOnceWith(
      process.execPath,
      [
        '--import',
        path.join(toolsRoot, 'node_modules/tsx/dist/loader.mjs'),
        fileURLToPath(
          new URL('./structured-validation-worker.ts', import.meta.url)
        ),
        '--plan-contract',
      ],
      {
        cwd: root,
        input: JSON.stringify(input),
        encoding: 'utf8',
        timeout: 120_000,
        shell: false,
      }
    );
  });

  it('preserves the exact mismatch paths for the existing finding projection', () => {
    const drift = [
      path.join(root, 'packages/react/API.md'),
      path.join(root, 'packages/metadata/src/components/Avatar.metadata.ts'),
    ];
    vi.mocked(childProcess.spawnSync).mockReturnValue(success(reply(drift)));
    expect(runComponentProductionPlanContractWorker({ root, input })).toEqual(
      drift
    );
  });

  it.each([
    null,
    {},
    { ...reply(), schemaVersion: 'unknown' },
    { ...reply(), componentName: 'DifferentComponent' },
    reply(null),
    reply([17]),
    reply(['relative/path']),
    reply(['/tmp/outside/API.md']),
    reply([root]),
    reply([root + '/bad\0path']),
  ])('rejects unsupported or unbound result %#', (value) => {
    vi.mocked(childProcess.spawnSync).mockReturnValue(success(value));
    expect(() =>
      runComponentProductionPlanContractWorker({ root, input })
    ).toThrow();
  });

  it('rejects malformed JSON', () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      ...success(reply()),
      stdout: 'truncated{',
    });
    expect(() =>
      runComponentProductionPlanContractWorker({ root, input })
    ).toThrow();
  });

  it.each([
    { status: 137 },
    { status: 2 },
    { status: null, signal: 'SIGKILL' as const },
    { error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) },
  ])(
    'rejects interrupted work even if stdout looks successful %#',
    (failure) => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        ...success(reply()),
        ...failure,
      });
      expect(() =>
        runComponentProductionPlanContractWorker({ root, input })
      ).toThrow('Plan contract worker failed');
    }
  );

  it.each([
    { exitCode: 137, stdout: '', stderr: 'Killed', timedOut: false },
    { exitCode: null, stdout: '', stderr: '', timedOut: true },
    { exitCode: 0, stdout: 'malformed{', stderr: '', timedOut: false },
  ])(
    'retains contract drift if the subsequent independent quality worker fails %#',
    async (failure) => {
      vi.mocked(childProcess.spawnSync).mockReturnValue(
        success(reply([path.join(root, 'packages/react/API.md')]))
      );
      let qualityCalled = false;
      const result = await runComponentProductionStructuredValidation({
        root,
        input,
        runner: () => {
          qualityCalled = true;
          return failure;
        },
      });
      expect(qualityCalled).toBe(true);
      expect(result.stages.map((s) => s.status)).toEqual(['failed', 'failed']);
      expect(
        result.stages[0].findings.some((f) =>
          f.id.includes('production-contract')
        )
      ).toBe(true);
      expect(
        result.stages[0].findings.some((f) =>
          f.message.includes('packages/react/API.md')
        )
      ).toBe(true);
    }
  );

  it('still runs independent quality after a plan-worker failure', async () => {
    vi.mocked(childProcess.spawnSync).mockReturnValue({
      ...success(reply()),
      status: 137,
    });
    let qualityCalled = false;
    const result = await runComponentProductionStructuredValidation({
      root,
      input,
      runner: () => {
        qualityCalled = true;
        return {
          exitCode: 0,
          timedOut: false,
          stderr: '',
          stdout: JSON.stringify({
            schemaVersion: '1',
            status: 'ok',
            componentName: 'Avatar',
            completeness: [],
            quality: {
              status: 'pass',
              report: {
                schemaVersion: '1',
                components: [
                  {
                    componentName: 'Avatar',
                    status: 'pass',
                    platforms: [],
                    findings: [],
                  },
                ],
              },
            },
          }),
        };
      },
    });
    expect(qualityCalled).toBe(true);
    expect(result.stages.map((s) => s.status)).toEqual(['failed', 'passed']);
  });
});
