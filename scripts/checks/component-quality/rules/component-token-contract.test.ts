import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ComponentMetadata } from '@vellira-ui/metadata';

import { componentTokenContractRule } from './component-token-contract';

const roots: string[] = [];

function createRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-quality-tokens-')
  );
  roots.push(root);
  return root;
}

function metadata(): ComponentMetadata {
  return {
    name: 'Probe',
    layer: 'components',
    category: 'utility',
    platforms: ['react', 'react-native'],
    profile: 'compound',
    status: 'experimental',
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
      componentTokens: 'standard',
    },
  };
}

function createTokenContract(root: string, layout: 'grouped' | 'flat' = 'grouped') {
  const factoriesRoot = path.join(root, 'packages/tokens/src/factories');
  const factoryDir =
    layout === 'grouped' ? path.join(factoriesRoot, 'components') : factoriesRoot;
  fs.mkdirSync(factoryDir, { recursive: true });
  fs.writeFileSync(
    path.join(factoryDir, 'createProbeTokens.ts'),
    'export {};\n'
  );
  fs.writeFileSync(
    path.join(factoriesRoot, 'index.ts'),
    layout === 'grouped'
      ? "export * from './components/createProbeTokens.js';\n"
      : "export * from './createProbeTokens.js';\n"
  );

  for (const theme of ['light', 'dark', 'highContrast']) {
    const dir = path.join(root, 'packages/tokens/src', theme, 'components');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'probe.ts'),
      'export const probeTokens = {};\n'
    );
    fs.writeFileSync(
      path.join(dir, 'index.ts'),
      "export { probeTokens as probe } from './probe.js';\n"
    );
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component token contract quality rule', () => {
  it('rejects generic semantic variables as a substitute for component tokens', () => {
    const root = createRoot();
    createTokenContract(root);

    const componentDir = path.join(root, 'packages/react/src/components/Probe');
    fs.mkdirSync(componentDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentDir, 'Probe.module.scss'),
      '.root { color: var(--text-primary); background: var(--surface-default); }\n'
    );

    const result = componentTokenContractRule.evaluate({
      metadata: metadata(),
      platform: 'react',
      rootDir: root,
    });

    expect(result).toMatchObject({
      status: 'fail',
      evidence: [
        'packages/react/src/components/Probe/Probe.module.scss — missing Web component-token usage: expected CSS variables with prefix --probe-',
      ],
    });
  });

  it('rejects the legacy flat component factory layout', () => {
    const root = createRoot();
    createTokenContract(root, 'flat');

    const componentDir = path.join(root, 'packages/react/src/components/Probe');
    fs.mkdirSync(componentDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentDir, 'Probe.module.scss'),
      '.root { color: var(--probe-default-fg); }\n'
    );

    const result = componentTokenContractRule.evaluate({
      metadata: metadata(),
      platform: 'react',
      rootDir: root,
    });

    expect(result).toMatchObject({
      status: 'fail',
      evidence: [
        'missing component token factory: packages/tokens/src/factories/components/createProbeTokens.ts',
        'missing component token factory export: packages/tokens/src/factories/index.ts',
      ],
    });
  });

  it('reports the exact React Native style path for missing component-token consumption', () => {
    const root = createRoot();
    createTokenContract(root);

    const componentDir = path.join(
      root,
      'packages/react-native/src/components/Probe'
    );
    fs.mkdirSync(componentDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentDir, 'Probe.styles.ts'),
      'export const createStyles = (theme: any) => ({ color: theme.colors.text });\n'
    );

    const result = componentTokenContractRule.evaluate({
      metadata: metadata(),
      platform: 'react-native',
      rootDir: root,
    });

    expect(result).toMatchObject({
      status: 'fail',
      evidence: [
        'packages/react-native/src/components/Probe/Probe.styles.ts — missing React Native component-token usage: expected theme.components.probe',
      ],
    });
  });

  it('accepts canonical component token consumption on Web and Native', () => {
    const root = createRoot();
    createTokenContract(root);

    const webDir = path.join(root, 'packages/react/src/components/Probe');
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(
      path.join(webDir, 'Probe.module.scss'),
      '.root { color: var(--probe-default-fg); }\n'
    );

    const nativeDir = path.join(
      root,
      'packages/react-native/src/components/Probe'
    );
    fs.mkdirSync(nativeDir, { recursive: true });
    fs.writeFileSync(
      path.join(nativeDir, 'Probe.styles.ts'),
      'export const createStyles = (theme: any) => ({ color: theme.components.probe.default.fg });\n'
    );

    expect(
      componentTokenContractRule.evaluate({
        metadata: metadata(),
        platform: 'react',
        rootDir: root,
      })
    ).toMatchObject({ status: 'pass' });

    expect(
      componentTokenContractRule.evaluate({
        metadata: metadata(),
        platform: 'react-native',
        rootDir: root,
      })
    ).toMatchObject({ status: 'pass' });
  });
});
