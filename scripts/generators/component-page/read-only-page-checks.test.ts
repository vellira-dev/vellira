import { describe, expect, it } from 'vitest';

import {
  runReadOnlyComponentPageChecks,
  type ReadOnlyPageCheck,
  type ReadOnlyPageCheckResult,
} from './read-only-page-checks';

const jobs: ReadOnlyPageCheck[] = ['Button', 'Modal', 'Tabs', 'Input'].map(
  (componentName) => ({
    componentName,
    executable: 'node',
    args: ['create-component-page.ts', componentName, '--check'],
  })
);

describe('bounded generated-page dry-run checks', () => {
  it('checks every component with at most two jobs in flight and stable output order', async () => {
    const completions = new Map<
      string,
      (result: ReadOnlyPageCheckResult) => void
    >();
    let inFlight = 0;
    let peak = 0;
    const checked: string[] = [];
    const execution = runReadOnlyComponentPageChecks(jobs, {
      execute: (job) =>
        new Promise((resolve) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          checked.push(job.componentName);
          completions.set(job.componentName, (result) => {
            inFlight -= 1;
            resolve(result);
          });
        }),
    });

    const finish = (name: string, status: number) => {
      const complete = completions.get(name);
      expect(complete).toBeDefined();
      complete?.({
        componentName: name,
        status,
        stdout: `stdout:${name}`,
        stderr: `stderr:${name}`,
      });
    };
    expect(checked).toEqual(['Button', 'Modal']);
    finish('Modal', 1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(checked).toEqual(['Button', 'Modal', 'Tabs']);
    finish('Tabs', 0);
    await new Promise((resolve) => setImmediate(resolve));
    expect(checked).toEqual(['Button', 'Modal', 'Tabs', 'Input']);
    finish('Input', 0);
    finish('Button', 0);

    const results = await execution;
    expect(peak).toBe(2);
    expect(inFlight).toBe(0);
    expect(results.map((result) => result.componentName)).toEqual(
      jobs.map((job) => job.componentName)
    );
    expect(results.map((result) => result.status)).toEqual([0, 1, 0, 0]);
    expect(results[1].stderr).toBe('stderr:Modal');
  });

  it('refuses generation commands and invalid concurrency before starting work', async () => {
    let started = 0;
    const execute = async (job: ReadOnlyPageCheck) => {
      started += 1;
      return {
        componentName: job.componentName,
        status: 0,
        stdout: '',
        stderr: '',
      };
    };
    await expect(
      runReadOnlyComponentPageChecks(
        [{ ...jobs[0], args: ['create-component-page.ts', '--force'] }],
        { execute }
      )
    ).rejects.toThrow(/read-only checks/);
    for (const concurrency of [0, 3, 1.5]) {
      await expect(
        runReadOnlyComponentPageChecks(jobs, { concurrency, execute })
      ).rejects.toThrow(/concurrency/);
    }
    expect(started).toBe(0);
  });

  it('fails closed on an executor error rather than claiming a complete check', async () => {
    await expect(
      runReadOnlyComponentPageChecks(jobs, {
        execute: async () => {
          throw new Error('check subprocess failed');
        },
      })
    ).rejects.toThrow('check subprocess failed');
  });

  it('handles an empty component list without launching processes', async () => {
    expect(await runReadOnlyComponentPageChecks([])).toEqual([]);
  });
});
