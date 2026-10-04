import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { summarizeValidationCommandOutput } from './validation-output';
import { componentProductionVisualCommand } from './visual-environment';

describe('bounded causal validation evidence', () => {
  it('retains compiler errors between progress messages and wrapper stacks', () => {
    const cause =
      'src/primitives/Probe/Probe.tsx(5,3): error TS2307: Cannot find module';
    const message = summarizeValidationCommandOutput({
      stdout: `${'successful build\n'.repeat(400)}${cause}\n${'wrapper stack\n'.repeat(400)}`,
      stderr: 'scripts/prune-dist-icons.ts finished',
    });
    expect(message).toContain(cause);
    expect(message).not.toContain('output truncated');
  });

  it('never silently truncates a failure set', () => {
    const message = summarizeValidationCommandOutput({
      stdout: 'x'.repeat(70_000),
      stderr: '',
    });
    expect(message).toContain('output truncated');
    expect(message.length).toBeLessThanOrEqual(64_000);
  });
});

describe('visual execution transport', () => {
  it('uses Docker when no canonical container is declared', () => {
    expect(componentProductionVisualCommand({})).toEqual([
      'pnpm',
      'test:e2e:web:visual:docker',
    ]);
  });
  it('uses the guarded visual entrypoint inside a declared container', () => {
    expect(
      componentProductionVisualCommand({
        VELLIRA_VISUAL_ENVIRONMENT: 'invalid',
      })
    ).toEqual(['pnpm', 'test:e2e:web:visual']);
    // The existing script rejects invalid declarations; selecting transport is
    // not evidence of a successful visual run.
  });
  it('rejects an invalid container declaration before running any snapshots', () => {
    const result = spawnSync(
      process.execPath,
      ['apps/react-storybook/scripts/assert-canonical-visual-environment.mjs'],
      {
        encoding: 'utf8',
        env: { ...process.env, VELLIRA_VISUAL_ENVIRONMENT: 'invalid' },
      }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Canonical visual environment check failed'
    );
  });
});
