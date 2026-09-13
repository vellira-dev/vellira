import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateComponentWebsitePage } from './website';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const tempRoots: string[] = [];

beforeEach(() => {
  vi.mocked(spawnSync).mockReset();
  vi.mocked(spawnSync).mockReturnValue({
    pid: 1,
    output: [],
    stdout: '',
    stderr: '',
    status: 0,
    signal: null,
  });
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function createRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-website-presentation-')
  );
  tempRoots.push(root);

  fs.writeFileSync(
    path.join(root, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        jsx: 'react-jsx',
      },
    })
  );

  for (const packageName of ['react', 'react-native']) {
    const sourceRoot = path.join(root, 'packages', packageName, 'src');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.writeFileSync(
      path.join(root, 'packages', packageName, 'tsconfig.json'),
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          rootDir: 'src',
          noEmit: true,
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      })
    );
  }

  return root;
}

describe('generated website presentation metadata', () => {
  it('creates capability-derived examples for a fresh generated component', () => {
    const root = createRoot();
    const metadataDir = path.join(root, 'packages/metadata/src/components');
    const componentDir = path.join(
      root,
      'packages/react/src/primitives/SwitchProbe'
    );
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.mkdirSync(componentDir, { recursive: true });
    fs.writeFileSync(
      path.join(metadataDir, 'SwitchProbe.metadata.ts'),
      `export const metadata = {
  capabilities: ['controlled', 'uncontrolled', 'disabled', 'required', 'invalid'],
};
`
    );
    fs.writeFileSync(
      path.join(componentDir, 'types.ts'),
      `export interface SwitchProbeProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
}
`
    );

    const result = generateComponentWebsitePage({
      root,
      componentName: 'SwitchProbe',
      profile: 'form-control',
      category: 'form',
    });
    const metadataFile = path.join(
      root,
      'apps/website/src/component-catalog/components/SwitchProbe/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    expect(result.createdFiles).toContain(metadataFile);
    expect(source).toContain("title: 'Controlled'");
    expect(source).toContain("props: ['checked']");
    expect(source).toContain("title: 'Uncontrolled'");
    expect(source).toContain("props: ['defaultChecked']");
    expect(source).toContain("title: 'Invalid'");
  });

  it('does not promote part-only capabilities to root-level examples', () => {
    const root = createRoot();
    const metadataDir = path.join(root, 'packages/metadata/src/components');
    const componentDir = path.join(
      root,
      'packages/react/src/components/CompoundProbe'
    );
    const itemDir = path.join(componentDir, 'Item');

    fs.mkdirSync(metadataDir, { recursive: true });
    fs.mkdirSync(itemDir, { recursive: true });
    fs.writeFileSync(
      path.join(metadataDir, 'CompoundProbe.metadata.ts'),
      `export const metadata = {
  capabilities: ['compound-api', 'disabled'],
};
`
    );
    fs.writeFileSync(
      path.join(componentDir, 'types.ts'),
      `export interface CompoundProbeProps {
  value?: string;
}
`
    );
    fs.writeFileSync(
      path.join(itemDir, 'types.ts'),
      `export interface CompoundProbeItemProps {
  disabled?: boolean;
}
`
    );

    generateComponentWebsitePage({
      root,
      componentName: 'CompoundProbe',
      profile: 'compound',
      category: 'navigation',
    });

    const metadataFile = path.join(
      root,
      'apps/website/src/component-catalog/components/CompoundProbe/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    expect(source).toContain("title: 'Basic'");
    expect(source).toContain("title: 'Rich content'");
    expect(source).not.toContain("title: 'Disabled'");
    expect(source).not.toContain("props: ['disabled']");
  });

  it('does not replace existing curated website metadata', () => {
    const root = createRoot();
    const metadataFile = path.join(
      root,
      'apps/website/src/component-catalog/components/Probe/metadata.ts'
    );
    fs.mkdirSync(path.dirname(metadataFile), { recursive: true });
    fs.writeFileSync(metadataFile, 'curated metadata\n');

    generateComponentWebsitePage({
      root,
      componentName: 'Probe',
      profile: 'base',
      category: 'utility',
    });

    expect(fs.readFileSync(metadataFile, 'utf8')).toBe('curated metadata\n');
  });
});
