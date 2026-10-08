import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runValidationCommandProcess } from './validation-command';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
const toolsRoot = fileURLToPath(new URL('../../', import.meta.url));
const candidateRoot = path.resolve('/tmp/exact-older-candidate');

beforeEach(() => {
  vi.mocked(spawnSync).mockReset();
  vi.mocked(spawnSync).mockReturnValue({
    status: 0,
    stdout: '',
    stderr: '',
  } as ReturnType<typeof spawnSync>);
});

describe('pinned canonical projection checks', () => {
  it.each([
    [
      'create-component-page.ts',
      ['pnpm', 'create:component-page', 'IdentityMarker', '--force', '--check'],
      ['IdentityMarker', '--force', '--check'],
    ],
    [
      'audit-component-pages.ts',
      ['pnpm', 'component-pages:audit', '--component', 'IdentityMarker'],
      ['--component', 'IdentityMarker'],
    ],
  ] as const)(
    'uses the validator checkout for %s while retaining the exact candidate cwd',
    (script, command, args) => {
      const result = runValidationCommandProcess(
        { command, timeoutMs: 1000 },
        candidateRoot,
        'empty'
      );
      expect(result.exitCode).toBe(0);
      expect(spawnSync).toHaveBeenCalledWith(
        process.execPath,
        [
          '--import',
          path.join(toolsRoot, 'node_modules/tsx/dist/loader.mjs'),
          path.join(toolsRoot, 'scripts/generators/component-page', script),
          ...args,
        ],
        expect.objectContaining({
          cwd: candidateRoot,
          shell: false,
          timeout: 1000,
        })
      );
    }
  );

  it.each([
    ['pnpm', '--filter', '@vellira-ui/react...', 'build'],
    ['pnpm', 'create:component-page', 'IdentityMarker', '--force'],
    ['pnpm', 'create:component-page', '../Untrusted', '--force', '--check'],
    [
      'pnpm',
      'create:component-page',
      'IdentityMarker',
      '--force',
      '--check',
      '--extra',
    ],
  ])(
    'preserves candidate execution for commands outside the fixed read-only projection contract: %s',
    (...command) => {
      runValidationCommandProcess(
        { command, timeoutMs: 1000 },
        candidateRoot,
        'empty'
      );
      expect(spawnSync).toHaveBeenCalledWith(
        command[0],
        command.slice(1),
        expect.objectContaining({ cwd: candidateRoot })
      );
    }
  );

  it('keeps normal same-checkout validation unchanged', () => {
    const command = [
      'pnpm',
      'create:component-page',
      'IdentityMarker',
      '--force',
      '--check',
    ];
    runValidationCommandProcess(
      { command, timeoutMs: 1000 },
      toolsRoot,
      'empty'
    );
    expect(spawnSync).toHaveBeenCalledWith(
      'pnpm',
      command.slice(1),
      expect.objectContaining({ cwd: toolsRoot })
    );
  });
});
