import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { mediaSpec } from '../component-program/fixtures/programs';
import { runComponentProductionPlanContractWorker } from './structured-validation';

const toolsRoot = fileURLToPath(new URL('../../', import.meta.url));
const loader = path.join(toolsRoot, 'node_modules/tsx/dist/loader.mjs');
const worker = fileURLToPath(
  new URL('./structured-validation-worker.ts', import.meta.url)
);
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('real plan-worker CLI boundary', () => {
  it.each([
    { args: ['--plan-contract', 'extra'], input: '{}' },
    { args: ['--plan-contract'], input: 'malformed{' },
    { args: ['--plan-contract'], input: '{}' },
  ])('rejects invalid CLI or stdin %#', (params) => {
    const result = spawnSync(
      process.execPath,
      ['--import', loader, worker, ...params.args],
      {
        cwd: toolsRoot,
        input: params.input,
        encoding: 'utf8',
        timeout: 10_000,
        shell: false,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('does not execute a candidate-provided replacement for validator-owned plan checking', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira plan authority ')
    );
    roots.push(root);
    const relative =
      'scripts/component-production/structured-validation-worker.ts';
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(
      path.join(root, relative),
      'throw new Error("CANDIDATE_WORKER_EXECUTED");'
    );
    // This empty candidate lacks required contract files. A candidate worker
    // must not turn it into a successful empty drift result.
    let failure: unknown;
    try {
      runComponentProductionPlanContractWorker({ root, input: mediaSpec() });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain(path.join(root, 'packages/react/API.md'));
    expect(String(failure)).toContain('exit=2');
    expect(String(failure)).not.toContain('CANDIDATE_WORKER_EXECUTED');
  });
});
