import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'component-quality-ci-'));
  temporaryRoots.push(root);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    `#!/bin/sh\nexit ${checkerStatus}\n`,
    { mode: 0o755 }
  );

  return spawnSync(
    'bash',
    ['-euo', 'pipefail', '-c', componentQualityStep(workflow)],
    {
      env: {
        ...process.env,
        COMPONENT_QUALITY_ENFORCEMENT: enforcement,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    }
  );
}

it('declares blocking enforcement for normal PR CI', () => {
  expect(qualityJob(workflow)).toContain(
    'COMPONENT_QUALITY_ENFORCEMENT: blocking'
  );
});

it('maps checker exit 1 to CI failure in blocking mode while WARN stays non-blocking', () => {
  expect(runCheckerStep(1, 'blocking').status).toBe(1);
  expect(runCheckerStep(0, 'blocking').status).toBe(0);
});

it('keeps checker exit 2 blocking regardless of enforcement mode', () => {
  expect(runCheckerStep(2, 'blocking').status).toBe(2);
  expect(runCheckerStep(2, 'advisory').status).toBe(2);
});
