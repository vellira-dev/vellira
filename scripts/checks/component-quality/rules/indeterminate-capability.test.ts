import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ComponentMetadata } from '@vellira-ui/metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { declaredCapabilitiesRule } from './api-feature';
import { storybookCoverageRule, testCoverageRule } from './coverage';

const roots: string[] = [];

const metadata: ComponentMetadata = {
  name: 'Example',
  layer: 'components',
  category: 'form',
  platforms: ['react'],
  profile: 'form-control',
  status: 'stable',
  capabilities: ['indeterminate'],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
};

function createFixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-indeterminate-capability-')
  );
  roots.push(root);
  vi.spyOn(process, 'cwd').mockReturnValue(root);

  const componentDir = path.join(
    root,
    'packages',
    'react',
    'src',
    'components',
    'Example'
  );
  fs.mkdirSync(componentDir, { recursive: true });

  fs.writeFileSync(
    path.join(componentDir, 'types.ts'),
    'export interface ExampleProps { indeterminate?: boolean; }\n'
  );
  fs.writeFileSync(
    path.join(componentDir, 'Example.tsx'),
    "import type { ExampleProps } from './types';\nexport function Example(props: ExampleProps) { return props.indeterminate ? 'mixed' : 'unchecked'; }\n"
  );
  fs.writeFileSync(
    path.join(componentDir, 'Example.test.tsx'),
    "it('renders the indeterminate mixed state', () => { const indeterminate = true; expect(indeterminate).toBe(true); });\n"
  );
  fs.writeFileSync(
    path.join(componentDir, 'Example.stories.tsx'),
    'export const Indeterminate = { args: { indeterminate: true } };\n'
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('indeterminate capability evidence', () => {
  it('requires matching source, executable test, and Storybook evidence', async () => {
    createFixture();

    const context = { metadata, platform: 'react' as const };

    expect((await declaredCapabilitiesRule.evaluate(context)).status).toBe(
      'pass'
    );
    expect((await testCoverageRule.evaluate(context)).status).toBe('pass');
    expect((await storybookCoverageRule.evaluate(context)).status).toBe('pass');
  });
});
