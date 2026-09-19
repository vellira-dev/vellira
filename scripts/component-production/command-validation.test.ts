import { describe, expect, it } from 'vitest';

import type { ComponentProductionInputV1 } from './contracts';
import {
  componentProductionValidationCommands,
  runComponentProductionCommandValidation,
  type ComponentProductionCommandExecution,
} from './command-validation';

const WEB_INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'web',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};

describe('componentProductionValidationCommands', () => {
  it('selects only React validation for a web component', () => {
    expect(
      componentProductionValidationCommands(WEB_INPUT).map(
        (command) => command.id
      )
    ).toEqual([
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-tests',
      'react-typecheck',
      'react-build',
      'react-storybook-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ]);
  });

  it('selects both platform validation paths for a cross-platform component', () => {
    expect(
      componentProductionValidationCommands({
        ...WEB_INPUT,
        platform: 'both',
      }).map((command) => command.id)
    ).toEqual([
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-tests',
      'react-typecheck',
      'react-build',
      'react-storybook-build',
      'react-native-tests',
      'react-native-typecheck',
      'react-native-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ]);
  });

  it('builds platform packages with their workspace dependency closure', () => {
    const commands = componentProductionValidationCommands({
      ...WEB_INPUT,
      platform: 'both',
    });

    expect(
      commands.find((command) => command.id === 'react-build')?.command
    ).toEqual(['pnpm', '--filter', '@vellira-ui/react...', 'build']);

    expect(
      commands.find((command) => command.id === 'react-native-build')?.command
    ).toEqual(['pnpm', '--filter', '@vellira-ui/react-native...', 'build']);
  });

  it('scopes website validation to the exact component without the global catalog check', () => {
    const websiteCommands = componentProductionValidationCommands({
      ...WEB_INPUT,
      componentName: 'Toast',
    }).filter((command) => command.stage === 'website');

    expect(websiteCommands.map((command) => command.id)).toEqual([
      'component-page-check',
      'component-page-audit',
    ]);
    expect(websiteCommands.map((command) => command.command)).toEqual([
      ['pnpm', 'create:component-page', 'Toast', '--force', '--check'],
      ['pnpm', 'component-pages:audit', '--component', 'Toast'],
    ]);
    expect(
      websiteCommands.some((command) =>
        command.command.includes('component-pages:check')
      )
    ).toBe(false);
  });
});

describe('runComponentProductionCommandValidation', () => {
  it('returns passed stages when every command succeeds', () => {
    const calls: string[] = [];

    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) => {
        calls.push(command.id);

        return success();
      },
    });

    expect(calls).toEqual([
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-tests',
      'react-typecheck',
      'react-build',
      'react-storybook-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ]);

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['format', 'passed'],
      ['lint', 'passed'],
      ['tests', 'passed'],
      ['typecheck', 'passed'],
      ['build', 'passed'],
      ['storybook', 'passed'],
      ['docs', 'passed'],
      ['website', 'passed'],
    ]);
  });

  it('does not run React Storybook for a native-only component', () => {
    const calls: string[] = [];

    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: {
        ...WEB_INPUT,
        platform: 'native',
      },
      runner: (command) => {
        calls.push(command.id);

        return success();
      },
    });

    expect(calls).not.toContain('react-storybook-build');
    expect(calls).toContain('component-docs');
    expect(calls).toContain('component-page-check');
    expect(calls).toContain('component-page-audit');

    expect(
      result.stages.find((stage) => stage.id === 'storybook')?.status
    ).toBe('passed');
  });

  it('treats non-zero validation exits as blocked findings', () => {
    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: {
        ...WEB_INPUT,
        platform: 'both',
      },
      runner: (command) => {
        if (command.id === 'react-tests') {
          return {
            exitCode: 1,
            stdout: '',
            stderr: 'Avatar test failed.',
            timedOut: false,
          };
        }

        return success();
      },
    });

    const tests = result.stages.find((stage) => stage.id === 'tests');

    expect(tests?.status).toBe('blocked');
    expect(tests?.findings).toEqual([
      {
        id: 'tests:react-tests',
        stage: 'tests',
        severity: 'blocking',
        message: 'react-tests exited with code 1: Avatar test failed.',
      },
    ]);
  });

  it('preserves stdout diagnostics when stderr also contains command output', () => {
    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) => {
        if (command.id === 'lint') {
          return {
            exitCode: 1,
            stdout: [
              '/tmp/vellira-production/packages/react/src/primitives/Avatar/Avatar.tsx',
              '  1:1  error  Avatar lint failed  example/rule',
            ].join('\\n'),
            stderr: "$ eslint 'packages/**/*.{ts,tsx}' 'apps/**/*.{ts,tsx}'",
            timedOut: false,
          };
        }

        return success();
      },
    });

    const lint = result.stages.find((stage) => stage.id === 'lint');
    const message = lint?.findings[0]?.message;

    expect(lint?.status).toBe('blocked');
    expect(message).toContain(
      '/tmp/vellira-production/packages/react/src/primitives/Avatar/Avatar.tsx'
    );
    expect(message).toContain('Avatar lint failed');
    expect(message).toContain('example/rule');
    expect(message).toContain("$ eslint 'packages/**/*.{ts,tsx}'");
  });

  it('continues collecting platform validation after one deterministic failure', () => {
    const calls: string[] = [];

    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: {
        ...WEB_INPUT,
        platform: 'both',
      },
      runner: (command) => {
        calls.push(command.id);

        if (command.id === 'react-tests') {
          return {
            exitCode: 1,
            stdout: 'failed',
            stderr: '',
            timedOut: false,
          };
        }

        return success();
      },
    });

    expect(calls).toContain('react-native-tests');
    expect(calls).not.toContain('react-typecheck');
    expect(calls).not.toContain('react-native-typecheck');
    expect(calls).not.toContain('react-build');
    expect(calls).not.toContain('component-docs');

    expect(
      result.stages
        .filter((stage) =>
          ['typecheck', 'build', 'storybook', 'docs', 'website'].includes(
            stage.id
          )
        )
        .every((stage) => stage.status === 'skipped')
    ).toBe(true);
  });

  it('treats timeout as a runtime failure', () => {
    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) => {
        if (command.id === 'react-build') {
          return {
            exitCode: null,
            stdout: '',
            stderr: '',
            timedOut: true,
          };
        }

        return success();
      },
    });

    const build = result.stages.find((stage) => stage.id === 'build');

    expect(build?.status).toBe('failed');
    expect(build?.findings[0]?.message).toContain('timed out');
  });

  it('keeps focused website command runtime failures blocking', () => {
    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) => {
        if (command.id === 'component-page-audit') {
          return {
            exitCode: null,
            stdout: '',
            stderr: '',
            timedOut: true,
          };
        }

        return success();
      },
    });

    const website = result.stages.find((stage) => stage.id === 'website');

    expect(website?.status).toBe('failed');
    expect(website?.findings).toEqual([
      expect.objectContaining({
        id: 'website:component-page-audit:runtime',
        stage: 'website',
        severity: 'blocking',
      }),
    ]);
    expect(website?.findings[0]?.message).toContain('timed out');
  });

  it('fails closed when a command runner throws', () => {
    const result = runComponentProductionCommandValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) => {
        if (command.id === 'lint') {
          throw new Error('runner unavailable');
        }

        return success();
      },
    });

    const lint = result.stages.find((stage) => stage.id === 'lint');

    expect(lint?.status).toBe('failed');
    expect(lint?.findings[0]?.message).toBe('runner unavailable');
  });
});

function success(): ComponentProductionCommandExecution {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
  };
}
