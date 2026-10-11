import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-batch-tooling-'));
  roots.push(root);
  const candidate = path.join(root, 'candidate');
  const tooling = path.join(root, 'tooling');
  const directory = 'scripts/generators/component-page';
  fs.mkdirSync(candidate, { recursive: true });
  fs.mkdirSync(path.join(tooling, directory, 'helpers'), { recursive: true });
  for (const file of [
    'check-component-pages.ts',
    'generate-component-pages.ts',
    'helpers/command.ts',
  ]) {
    fs.copyFileSync(
      path.join(process.cwd(), directory, file),
      path.join(tooling, directory, file)
    );
  }
  fs.symlinkSync(
    path.join(process.cwd(), 'node_modules'),
    path.join(tooling, 'node_modules')
  );
  fs.writeFileSync(path.join(tooling, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(
    path.join(candidate, 'package.json'),
    JSON.stringify({
      scripts: {
        'component-pages:generate': 'node -e "process.exit(42)"',
        'create:component-page': 'node -e "process.exit(42)"',
      },
    })
  );
  fs.writeFileSync(
    path.join(tooling, directory, 'component-page-components.ts'),
    'export const getGeneratedComponentPageComponents = () => ["FixtureCard"];'
  );
  const cwdGuard =
    'if (process.cwd() !== process.env.EXPECTED_CANDIDATE_ROOT) process.exit(43);';
  fs.writeFileSync(
    path.join(tooling, directory, 'audit-catalog-previews.ts'),
    cwdGuard
  );
  fs.writeFileSync(
    path.join(tooling, directory, 'create-component-page.ts'),
    `${cwdGuard}
    if (!process.argv.includes('FixtureCard') || !process.argv.includes('--force')) process.exit(44);
    if (process.env.EXPECT_CHECK === 'true' && !process.argv.includes('--check')) process.exit(45);
    const stale = process.env.STUB_STALE === 'true';
    console.log(JSON.stringify({ componentName: 'FixtureCard', status: stale ? 'stale' : 'up-to-date', staleFiles: stale ? ['FixtureCardExamples.tsx'] : [] }));
    process.exitCode = stale ? 1 : 0;
  `
  );
  return { candidate, tooling, directory };
}

function run(
  script: string,
  args: string[],
  options: { stale?: boolean; check?: boolean } = {}
) {
  const { candidate, tooling, directory } = fixture();
  return spawnSync(
    process.execPath,
    [
      '--import',
      path.join(tooling, 'node_modules/tsx/dist/loader.mjs'),
      path.join(tooling, directory, script),
      ...args,
    ],
    {
      cwd: candidate,
      encoding: 'utf8',
      env: {
        ...process.env,
        EXPECTED_CANDIDATE_ROOT: fs.realpathSync(candidate),
        EXPECT_CHECK: String(options.check ?? false),
        STUB_STALE: String(options.stale ?? false),
      },
    }
  );
}

describe('batch projection commands with a separately versioned candidate', () => {
  it('keeps preview audit and every nested freshness check on the tooling revision', () => {
    const result = run('check-component-pages.ts', [], { check: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'All 1 generated component pages are up to date.'
    );
  });
  it('preserves machine-readable check results and candidate cwd', () => {
    const result = run('generate-component-pages.ts', ['--check', '--json'], {
      check: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '1',
      status: 'up-to-date',
      components: [
        { componentName: 'FixtureCard', status: 'up-to-date', staleFiles: [] },
      ],
    });
  });
  it('propagates stale nested output as a failed check', () => {
    const result = run('generate-component-pages.ts', ['--check', '--json'], {
      stale: true,
      check: true,
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'stale',
      components: [{ staleFiles: ['FixtureCardExamples.tsx'] }],
    });
  });
  it('retains the write-mode command routing', () => {
    const result = run('generate-component-pages.ts', []);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'Generated 1 component pages successfully.'
    );
  });
});
