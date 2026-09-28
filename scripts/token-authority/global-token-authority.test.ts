import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  baseTokenPaths,
  colorTokenPaths,
  semanticTokenPaths,
} from '../../packages/tokens/src/generated/token-types';
import {
  buildGlobalTokenAuthorityContract,
  GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION,
  GLOBAL_TOKEN_AUTHORITY_SOURCE_ARTIFACT,
  runGlobalTokenAuthorityCli,
} from './global-token-authority';

describe('global token authority protocol', () => {
  it('projects the exact generated global token inventory', () => {
    const contract = buildGlobalTokenAuthorityContract();
    const expected = [
      ...baseTokenPaths,
      ...colorTokenPaths,
      ...semanticTokenPaths,
    ]
      .map((value) => `theme.${value}`)
      .sort();

    expect(contract).toEqual({
      schemaVersion: GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION,
      sourceArtifact: GLOBAL_TOKEN_AUTHORITY_SOURCE_ARTIFACT,
      reactNativeThemePaths: expected,
    });
    expect(new Set(contract.reactNativeThemePaths).size).toBe(
      contract.reactNativeThemePaths.length
    );
    expect(
      contract.reactNativeThemePaths.some((value) =>
        value.startsWith('theme.components.')
      )
    ).toBe(false);
  });

  it('emits one machine-readable JSON document through the package command', () => {
    const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const result = spawnSync(
      pnpm,
      ['--silent', 'global-token-authority:json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(
      buildGlobalTokenAuthorityContract()
    );
  });

  it('fails closed with structured stderr on unsupported arguments', () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const status = runGlobalTokenAuthorityCli(['--unexpected'], {
      write: (message) => stdout.push(message),
      writeError: (message) => stderr.push(message),
    });

    expect(status).toBe(2);
    expect(stdout).toEqual([]);
    expect(stderr).toHaveLength(1);
    expect(JSON.parse(stderr[0] ?? '')).toEqual({
      schemaVersion: GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION,
      status: 'error',
      error: {
        message: 'Unknown global-token authority option "--unexpected".',
      },
    });
  });
});
