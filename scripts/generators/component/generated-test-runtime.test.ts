import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  renderFormControlComponentTemplate,
  renderFormControlTypesTemplate,
  renderSharedFormControlTypesTemplate,
} from './templates/component-form-control';
import { renderNativeStylesTemplate } from './templates/component-native-styles';
import { renderStylesTemplate } from './templates/component-styles';
import { renderTestTemplate } from './templates/component-test';

// Exercise the canonical Switch token contract in an unexported fixture module.
// Arbitrary newly owned token families are covered by production E2E fixtures.
const fixtureName = 'Switch';
const fixtureLayer = '__generated-contract-fixtures';
const packageRoots = [
  path.resolve('packages/react'),
  path.resolve('packages/react-native'),
];

function fixtureDirectory(packageRoot: string) {
  return path.join(packageRoot, 'src', fixtureLayer, fixtureName);
}

function runCommand(params: { cwd: string; args: string[]; label: string }) {
  const result = spawnSync('pnpm', params.args, {
    cwd: params.cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
    },
  });

  expect(
    result.status,
    `${params.label} failed:\n${result.stdout}\n${result.stderr}`
  ).toBe(0);
}

function writeFixture(params: { packageRoot: string; isNative: boolean }) {
  const { packageRoot, isNative } = params;
  const directory = fixtureDirectory(packageRoot);

  fs.mkdirSync(directory, { recursive: true });

  const sharedTypes = renderSharedFormControlTypesTemplate({
    componentName: fixtureName,
    control: 'boolean',
  });
  const platformTypes = renderFormControlTypesTemplate({
    componentName: fixtureName,
    control: 'boolean',
  }).replace(
    `import type { Base${fixtureName}Props } from '@vellira-ui/types';`,
    ''
  );

  fs.writeFileSync(
    path.join(directory, 'types.ts'),
    `${sharedTypes}\n${platformTypes}`
  );

  fs.writeFileSync(
    path.join(directory, `${fixtureName}.tsx`),
    renderFormControlComponentTemplate({
      componentName: fixtureName,
      isNative,
      control: 'boolean',
    })
  );

  fs.writeFileSync(
    path.join(
      directory,
      isNative ? `${fixtureName}.styles.ts` : `${fixtureName}.module.scss`
    ),
    isNative
      ? renderNativeStylesTemplate({
          componentName: fixtureName,
          profile: 'form-control',
          control: 'boolean',
        })
      : renderStylesTemplate({
          componentName: fixtureName,
          profile: 'form-control',
          control: 'boolean',
        })
  );

  fs.writeFileSync(
    path.join(directory, `${fixtureName}.test.tsx`),
    renderTestTemplate({
      componentName: fixtureName,
      isNative,
      profile: 'form-control',
      control: 'boolean',
      capabilities: [
        'controlled',
        'uncontrolled',
        'disabled',
        'required',
        'invalid',
      ],
    })
  );
}

afterEach(() => {
  for (const packageRoot of packageRoots) {
    fs.rmSync(fixtureDirectory(packageRoot), {
      recursive: true,
      force: true,
    });
  }
});

describe('generated component baseline tests', () => {
  it('compile and execute for React and React Native', () => {
    for (const packageRoot of packageRoots) {
      const isNative = packageRoot.endsWith('react-native');

      writeFixture({ packageRoot, isNative });

      runCommand({
        cwd: packageRoot,
        args: ['exec', 'tsc', '-p', 'tsconfig.typecheck.json', '--noEmit'],
        label: `${isNative ? 'React Native' : 'React'} generated test typecheck`,
      });

      runCommand({
        cwd: packageRoot,
        args: [
          'exec',
          'vitest',
          'run',
          `src/${fixtureLayer}/${fixtureName}/${fixtureName}.test.tsx`,
          '--config',
          'vitest.config.ts',
        ],
        label: `${isNative ? 'React Native' : 'React'} generated test execution`,
      });
    }
  }, 120_000);
});
