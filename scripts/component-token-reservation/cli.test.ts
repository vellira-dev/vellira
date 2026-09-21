import { describe, expect, it } from 'vitest';

import { runComponentTokenReservationCli } from './cli';

function sink() {
  let value = '';
  return {
    stream: {
      write(chunk: string | Uint8Array) {
        value += String(chunk);
        return true;
      },
    },
    read: () => value,
  };
}

describe('component-token reservation CLI', () => {
  it('fails closed on incomplete arguments with machine-readable evidence', async () => {
    const output = sink();
    const error = sink();
    expect(
      await runComponentTokenReservationCli([], {
        stdout: output.stream,
        stderr: error.stream,
        env: { NODE_ENV: 'test' },
      })
    ).toBe(2);
    expect(output.read()).toBe('');
    expect(JSON.parse(error.read())).toMatchObject({
      schemaVersion: '1',
      status: 'error',
      action: 'rejected',
    });
  });

  it('requires the workflow-scoped token before any GitHub access', async () => {
    const error = sink();
    expect(
      await runComponentTokenReservationCli(
        [
          '--repo',
          'vellira-dev/vellira',
          '--source-revision',
          'a'.repeat(40),
          '--issue-number',
          '1262',
        ],
        { stderr: error.stream, env: { NODE_ENV: 'test' } }
      )
    ).toBe(2);
    expect(JSON.parse(error.read()).error.message).toMatch(/GITHUB_TOKEN/);
  });
});
