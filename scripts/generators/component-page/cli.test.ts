import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

const fixtureRoots: string[] = [];

function repoRoot() {
  return process.cwd();
}

function copyIfExists(root: string, fixture: string, relativePath: string) {
  const source = path.join(root, relativePath);
  const target = path.join(fixture, relativePath);

  if (!fs.existsSync(source)) return;

  fs.cpSync(source, target, {
    recursive: true,
    filter: (item) =>
      !item.includes(`${path.sep}.next${path.sep}`) &&
      !item.includes(`${path.sep}dist${path.sep}`) &&
      !item.includes(`${path.sep}coverage${path.sep}`),
  });
}

function createFixtureRepo() {
  const root = repoRoot();
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-page-cli-')
  );
  fixtureRoots.push(fixture);

  for (const relativePath of [
    'apps',
    'packages',
    'scripts',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.tooling.json',
    'tsconfig.tooling.test.json',
    'vitest.config.ts',
    'vitest.tooling.config.ts',
    '.prettierrc.js',
    '.prettierignore',
  ]) {
    copyIfExists(root, fixture, relativePath);
  }

  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(fixture, 'node_modules')
  );

  return fixture;
}

function runGenerator(
  fixture: string,
  args: readonly string[]
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return spawnSync(
    'node',
    [
      path.join(repoRoot(), 'node_modules/tsx/dist/cli.mjs'),
      'scripts/generators/component-page/create-component-page.ts',
      ...args,
    ],
    {
      cwd: fixture,
      encoding: 'utf8',
    }
  );
}

function runAudit(
  fixture: string,
  args: readonly string[] = ['--component', 'Button']
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return spawnSync(
    'node',
    [
      path.join(repoRoot(), 'node_modules/tsx/dist/cli.mjs'),
      'scripts/generators/component-page/audit-component-pages.ts',
      ...args,
    ],
    {
      cwd: fixture,
      encoding: 'utf8',
    }
  );
}

function generatedButtonApiPath(fixture: string) {
  return path.join(
    fixture,
    'apps/website/src/component-catalog/components/Button/buttonApi.ts'
  );
}

function generatedButtonFiles(fixture: string) {
  const root = path.join(
    fixture,
    'apps/website/src/component-catalog/components/Button'
  );

  return [
    'ButtonAccessibility.tsx',
    'ButtonDemo.tsx',
    'ButtonExamples.tsx',
    'ButtonPlayground.tsx',
    'ButtonUsage.tsx',
    'NativeButtonDemo.tsx',
    'buttonApi.ts',
    'buttonPlaygroundSchema.ts',
    'index.ts',
  ].map((fileName) => path.join(root, fileName));
}

function snapshotFiles(filePaths: readonly string[]) {
  return new Map(
    filePaths.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')])
  );
}

function expectFilesUnchanged(snapshot: Map<string, string>) {
  for (const [filePath, content] of snapshot) {
    expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
  }
}

function createCanonicalFixtureRepo() {
  const fixture = createFixtureRepo();
  const result = runGenerator(fixture, ['Button', '--force']);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');

  return fixture;
}

afterEach(() => {
  for (const fixture of fixtureRoots.splice(0)) {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

describe('component page CLI check modes', () => {
  it('keeps human-readable check compatible with registry validation', () => {
    const fixture = createCanonicalFixtureRepo();
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, ['Button', '--force', '--check']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'Generated component page is up to date: Button'
    );
    expect(result.stdout).toContain(
      'Skipped component catalog registration: button'
    );
    expect(result.stderr).toBe('');
    expectFilesUnchanged(before);
  }, 60_000);

  it('emits structured JSON check output with valid registry paths', () => {
    const fixture = createCanonicalFixtureRepo();
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '1',
      componentName: 'Button',
      status: 'up-to-date',
      staleFiles: [],
    });
    expectFilesUnchanged(before);
  }, 60_000);

  it('reports stale generated files in JSON check mode without mutating them', () => {
    const fixture = createCanonicalFixtureRepo();
    const apiFile = generatedButtonApiPath(fixture);
    const staleContent = `${fs.readFileSync(apiFile, 'utf8')}\n// stale fixture drift\n`;
    fs.writeFileSync(apiFile, staleContent);
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload).toEqual({
      schemaVersion: '1',
      componentName: 'Button',
      status: 'stale',
      staleFiles: [
        'apps/website/src/component-catalog/components/Button/buttonApi.ts',
      ],
    });
    expect(payload.staleFiles).toEqual([...payload.staleFiles].sort());
    expectFilesUnchanged(before);
  }, 60_000);

  it('fails --check when effective related metadata is non-canonical', () => {
    const fixture = createCanonicalFixtureRepo();
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source.replace(
        "related: ['input', 'checkbox', 'modal']",
        "related: ['Input']"
      )
    );

    const result = runGenerator(fixture, ['Button', '--force', '--check']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Button related[0] "Input" is invalid: unknown or non-canonical related component slug'
    );
  }, 60_000);

  it('audits only the selected component without rewriting generated files', () => {
    const fixture = createCanonicalFixtureRepo();
    const before = snapshotFiles(generatedButtonFiles(fixture));
    const unrelatedUsage = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Input/InputUsage.tsx'
    );
    fs.unlinkSync(unrelatedUsage);

    const result = runAudit(fixture);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(
      'Component page audit passed for 1 components.'
    );
    expectFilesUnchanged(before);
    expect(fs.existsSync(unrelatedUsage)).toBe(false);
  }, 60_000);

  it('rejects unknown audit selections instead of silently running all components', () => {
    const result = runAudit(repoRoot(), ['--component', 'NotAComponent']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Unknown generated component "NotAComponent"'
    );
    expect(result.stdout).not.toContain('Component page audit passed');
  });

  it('retains shared registry validation outside the selected component', () => {
    const fixture = createCanonicalFixtureRepo();
    const registryFile = path.join(
      fixture,
      'apps/website/src/component-catalog/registry/componentPages.ts'
    );
    const source = fs.readFileSync(registryFile, 'utf8');

    const invalidRegistry = source.replace(
      /(\n  input: \{[\s\S]*?related: )\[[^\]]*\]/,
      "$1['Input']"
    );
    expect(invalidRegistry).not.toBe(source);
    fs.writeFileSync(registryFile, invalidRegistry);

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'input related[0] "Input" is invalid: unknown or non-canonical related component slug'
    );
  }, 60_000);
});
