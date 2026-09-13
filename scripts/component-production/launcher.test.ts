import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const timeout = 30_000;

function scripts(manifest: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8')).scripts;
}

// This is the controlled-production call chain, not a repository-wide CLI ban.
const launchers = [
  [
    'package.json',
    'component-production:json',
    'node --import tsx scripts/component-production/cli.ts',
  ],
  [
    'package.json',
    'component-production:validate:json',
    'node --import tsx scripts/component-production/validate-cli.ts',
  ],
  [
    'package.json',
    'check:component-quality:contract',
    'node --import tsx scripts/checks/component-quality/completion-contract-cli.ts',
  ],
  [
    'package.json',
    'create:component-page',
    'node --import tsx scripts/generators/component-page/create-component-page.ts',
  ],
  [
    'package.json',
    'component-docs:generate',
    'node --import tsx scripts/generators/component-docs/generate-component-docs.ts',
  ],
  [
    'package.json',
    'component-pages:check',
    'node --import tsx scripts/generators/component-page/check-component-pages.ts',
  ],
  [
    'package.json',
    'component-pages:generate',
    'node --import tsx scripts/generators/component-page/generate-component-pages.ts',
  ],
  [
    'package.json',
    'check:tokens-semantic:strict',
    'node --import tsx scripts/checks/token-semantic/cli.ts',
  ],
  [
    'packages/tokens/package.json',
    'generate:types',
    'node --import tsx scripts/generate-token-types.ts',
  ],
  [
    'packages/tokens/package.json',
    'generate:types:check',
    'node --import tsx scripts/generate-token-types.ts --check',
  ],
  [
    'packages/tokens/package.json',
    'preservation:check',
    'node --import tsx scripts/token-preservation-cli.ts --check',
  ],
  [
    'packages/tokens/package.json',
    'build:tokens',
    'pnpm run generate:types && node --import tsx scripts/generate-css.ts',
  ],
  [
    'packages/icons/package.json',
    'generate',
    'node --import tsx scripts/generate-icons.ts',
  ],
  [
    'packages/icons/package.json',
    'build',
    'pnpm run generate && tsc -p tsconfig.build.json && node --import tsx scripts/prune-dist-icons.ts',
  ],
] as const;

describe('controlled production launcher scope', () => {
  it.each(launchers)(
    '%s / %s preserves its target and arguments',
    (manifest, name, command) => {
      expect(scripts(manifest)[name]).toBe(command);
    }
  );

  it.each([
    [
      'package.json',
      'create:component',
      'tsx scripts/generators/component/create-component.ts',
    ],
    ['package.json', 'blog:check', 'tsx scripts/blog/check.ts'],
    [
      'packages/tokens/package.json',
      'preservation:baseline',
      'tsx scripts/token-preservation-cli.ts --write',
    ],
  ])('keeps %s / %s outside the launcher policy', (manifest, name, command) => {
    expect(scripts(manifest)[name]).toBe(command);
  });
});

describe('controlled production launcher execution', () => {
  let temporaryRoot: string;
  let spec: string;
  let probe: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(() => {
    temporaryRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-launcher-test-'))
    );
    spec = path.join(temporaryRoot, 'malformed specification with spaces.json');
    const preload = path.join(temporaryRoot, 'reject-listen.cjs');
    probe = path.join(temporaryRoot, 'probe.mts');
    // Invalid JSON prevents either CLI from reaching generation or validation.
    fs.writeFileSync(spec, '{ invalid launcher fixture');
    fs.writeFileSync(
      preload,
      [
        "const net = require('node:net');",
        'net.Server.prototype.listen = function () {',
        "  throw new Error('LAUNCHER_LISTEN_FORBIDDEN');",
        '};',
      ].join('\n')
    );
    fs.writeFileSync(
      probe,
      [
        "import { pathToFileURL } from 'node:url';",
        'enum Answer { Value = 42 }',
        'const value: number = await Promise.resolve(Answer.Value);',
        "if (process.argv.includes('--throw')) throw new Error('LAUNCHER_PROBE_FAILURE');",
        'console.log(JSON.stringify({ value, argv: process.argv.slice(2), cwd: process.cwd(), main: import.meta.url === pathToFileURL(process.argv[1]).href }));',
        "console.error('LAUNCHER_PROBE_STDERR');",
        "if (process.argv.includes('--exit')) process.exitCode = 7;",
      ].join('\n')
    );
    env = {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--require=${JSON.stringify(preload)}`,
      ]
        .filter(Boolean)
        .join(' '),
    };
  });

  afterAll(() => {
    if (temporaryRoot)
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it('proves the preload rejects listeners without asking the OS to bind', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', "require('node:net').createServer().listen(0)"],
      {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('LAUNCHER_LISTEN_FORBIDDEN');
  });

  it.each(['component-production:json', 'component-production:validate:json'])(
    '%s reaches the real CLI with an exact spaced spec path and no listener',
    (command) => {
      const result = spawnSync('pnpm', ['--silent', command, '--spec', spec], {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(JSON.parse(result.stderr)).toMatchObject({
        schemaVersion: '1',
        status: 'error',
        error: {
          message: expect.stringContaining(
            `Unable to read component production specification "${spec}":`
          ),
        },
      });
      expect(result.stderr).not.toContain('LAUNCHER_LISTEN_FORBIDDEN');
      expect(fs.readFileSync(spec, 'utf8')).toBe('{ invalid launcher fixture');
      expect(fs.readdirSync(temporaryRoot).sort()).toEqual(
        [path.basename(spec), 'probe.mts', 'reject-listen.cjs'].sort()
      );
    },
    timeout + 5_000
  );

  it.each([
    [
      ['LauncherProbe', '--platform', 'invalid'],
      'Expected --platform to be one of: web, native, all.',
    ],
    [
      ['LauncherProbe', '--unknown option with spaces'],
      'Unknown option "--unknown option with spaces".',
    ],
  ])(
    'quality contract reaches CLI argument validation without a listener: %j',
    (args, diagnostic) => {
      // Argument errors occur before contract construction or component work.
      const result = spawnSync(
        'pnpm',
        ['--silent', 'check:component-quality:contract', ...args],
        { cwd: root, env, encoding: 'utf8', timeout }
      );
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        `Component Quality completion contract error: ${diagnostic}\n`
      );
      expect(result.stderr).not.toContain('LAUNCHER_LISTEN_FORBIDDEN');
    },
    timeout + 5_000
  );

  it.each([
    ['normal', [], 0],
    ['explicit exit', ['--exit'], 7],
  ] as const)(
    'preserves %s, ESM entrypoint identity, cwd, arguments and output',
    (_name, args, status) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', probe, '--spec', spec, ...args],
        {
          cwd: root,
          env,
          encoding: 'utf8',
          timeout,
        }
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(status);
      expect(JSON.parse(result.stdout)).toEqual({
        value: 42,
        argv: ['--spec', spec, ...args],
        cwd: fs.realpathSync(root),
        main: true,
      });
      expect(result.stderr).toBe('LAUNCHER_PROBE_STDERR\n');
    }
  );

  it('preserves thrown failures and TypeScript source locations', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', probe, '--throw'],
      {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('LAUNCHER_PROBE_FAILURE');
    expect(result.stderr).toContain(`${probe}:4`);
  });
});
