import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import { expect, it } from 'vitest';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

function qualityJob(source: string) {
  const match = source.match(/\n {2}quality:\n([\s\S]*?)(?=\n {2}[\w-]+:\n|$)/);
  expect(match, 'quality job').not.toBeNull();
  return match?.[1] ?? '';
}

function componentQualityStep(source: string) {
  const match = source.match(
    /\n {6}- name: Component Quality Checker\n([\s\S]*?)(?=\n {6}- name:|$)/
  );
  expect(match, 'Component Quality Checker step').not.toBeNull();
  const step = match?.[1] ?? '';
  const run = step.match(/\n {8}run: \|\n([\s\S]*)/);
  expect(run, 'Component Quality Checker script').not.toBeNull();
  if (!run) throw new Error('Component Quality Checker script not found');
  return run[1]
    .split('\n')
    .map((line) => line.slice(10))
    .join('\n');
}

function runCheckerStep(checkerStatus: number, enforcement: string) {
  // An interpreter-owned mock works on noexec temporary filesystems. Its
  // return code and exact invocation still exercise the original shell gate.
  const mock =
    'pnpm() { printf "%s\\n" "$*" >&2; return "$PROBE_CHECKER_STATUS"; }\n';
  const result = spawnSync(
    'bash',
    ['-euo', 'pipefail', '-c', mock + componentQualityStep(workflow)],
    {
      env: {
        ...process.env,
        COMPONENT_QUALITY_ENFORCEMENT: enforcement,
        PROBE_CHECKER_STATUS: String(checkerStatus),
      },
      encoding: 'utf8',
    }
  );
  expect(result.stderr).toBe('check:component-quality --all\n');
  return result;
}

it('declares blocking enforcement for normal PR CI', () => {
  expect(qualityJob(workflow)).toContain(
    'COMPONENT_QUALITY_ENFORCEMENT: blocking'
  );
});

it('maps checker exit 1 to CI failure in blocking mode while WARN stays non-blocking', () => {
  expect(runCheckerStep(1, 'blocking').status).toBe(1);
  expect(runCheckerStep(0, 'blocking').status).toBe(0);
  expect(runCheckerStep(1, 'advisory').status).toBe(0);
  expect(runCheckerStep(0, 'advisory').status).toBe(0);
});

it('keeps checker exit 2 blocking regardless of enforcement mode', () => {
  expect(runCheckerStep(2, 'blocking').status).toBe(2);
  expect(runCheckerStep(2, 'advisory').status).toBe(2);
});

it.each([3, 126, 127, 137])(
  'rejects unexpected execution failure %i in both enforcement modes',
  (status) => {
    expect(runCheckerStep(status, 'blocking').status).toBe(status);
    expect(runCheckerStep(status, 'advisory').status).toBe(status);
  }
);
