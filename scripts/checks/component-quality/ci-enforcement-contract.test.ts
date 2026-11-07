import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

function qualityJob(source: string) {
  const match = source.match(/\n {2}quality:\n([\s\S]*?)(?=\n {2}[\w-]+:\n|$)/);
  expect(match, 'quality job').not.toBeNull();
  return match?.[1] ?? '';
}

function qualityStep(
  source: string,
  name: 'Component Quality Checker' | 'Generate Component Quality report'
) {
  const match = source.match(
    new RegExp(`\\n {6}- name: ${name}\\n([\\s\\S]*?)(?=\\n {6}- name:|$)`)
  );
  expect(match, `${name} step`).not.toBeNull();
  const step = match?.[1] ?? '';
  const run = step.match(/\n {8}run: \|\n([\s\S]*)/);
  expect(run, `${name} script`).not.toBeNull();
  if (!run) throw new Error(`${name} script not found`);
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
    [
      '--noprofile',
      '--norc',
      '-euo',
      'pipefail',
      '-c',
      mock + qualityStep(workflow, 'Component Quality Checker'),
    ],
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

it.each([0, 1, 2, 3, 126, 127, 137])(
  'preserves report runtime failure %i despite a redirected output file',
  (status) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-report-'));
    try {
      const mock = `pnpm() {
        printf '%s\\n' "$*" >&2
        if [ "$PROBE_CHECKER_STATUS" -le 1 ]; then printf '{"findings":[]}'; fi
        return "$PROBE_CHECKER_STATUS"
      }\n`;
      const result = spawnSync(
        'bash',
        [
          '--noprofile',
          '--norc',
          '-euo',
          'pipefail',
          '-c',
          mock + qualityStep(workflow, 'Generate Component Quality report'),
        ],
        {
          cwd: root,
          env: { ...process.env, PROBE_CHECKER_STATUS: String(status) },
          encoding: 'utf8',
        }
      );
      expect(result.stderr).toBe('check:component-quality:json\n');
      expect(result.status).toBe(status <= 1 ? 0 : status);
      const report = fs.readFileSync(
        path.join(root, '.artifacts/component-quality/report.json'),
        'utf8'
      );
      // Redirection creates an empty artifact even when the checker cannot run.
      // File existence must never turn a runtime error into a successful step.
      expect(report).toBe(status <= 1 ? '{"findings":[]}' : '');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
);
