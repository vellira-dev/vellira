import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ComponentMetadata } from '@vellira-ui/metadata';
import {
  createComponentTestCoverageContract,
  renderComponentTestCoverageContract,
} from '../../generators/component/coverage-contract';
import { checkTestCoverageContract } from './check-test-coverage';

const roots: string[] = [];

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-test-contract-'));
  roots.push(root);
  return root;
}

const metadata: ComponentMetadata = {
  name: 'Switch',
  layer: 'components',
  category: 'form',
  platforms: ['react'],
  profile: 'form-control',
  status: 'stable',
  capabilities: [
    'controlled',
    'uncontrolled',
    'disabled',
    'required',
    'invalid',
  ],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
};

const overlayMetadata: ComponentMetadata = {
  name: 'Dialog',
  layer: 'components',
  category: 'overlay',
  platforms: ['react'],
  profile: 'overlay',
  status: 'stable',
  capabilities: [
    'controlled',
    'uncontrolled',
    'keyboard',
    'focus-management',
    'compound-api',
    'portal',
  ],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('test coverage contract completeness validation', () => {
  it('passes when metadata, contract, and generated test marker agree', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Switch.test-contract.json');
    const testFile = path.join(root, 'Switch.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Switch',
      profile: 'form-control',
      control: 'boolean',
      capabilities: metadata.capabilities ?? [],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );

    expect(
      checkTestCoverageContract({
        contractFile,
        testFile,
        metadata,
        platform: 'react',
      })
    ).toEqual({ name: 'tests', platform: 'react', ok: true });
  });

  it('fails when metadata capabilities invalidate the generated contract', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Switch.test-contract.json');
    const testFile = path.join(root, 'Switch.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Switch',
      profile: 'form-control',
      control: 'boolean',
      capabilities: ['controlled', 'uncontrolled'],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );

    const result = checkTestCoverageContract({
      contractFile,
      testFile,
      metadata,
      platform: 'react',
    });

    expect(result.ok).toBe(false);
    expect(result.details).toContain('requirements drift');
  });

  it('fails when generated tests no longer match the contract marker', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Switch.test-contract.json');
    const testFile = path.join(root, 'Switch.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Switch',
      profile: 'form-control',
      control: 'boolean',
      capabilities: metadata.capabilities ?? [],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(testFile, '// Baseline contract: render\n');

    const result = checkTestCoverageContract({
      contractFile,
      testFile,
      metadata,
      platform: 'react',
    });

    expect(result.ok).toBe(false);
    expect(result.details).toContain('baseline test contract is stale');
  });

  it('fails when required manual overlay coverage is missing', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Dialog.test-contract.json');
    const testFile = path.join(root, 'Dialog.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Dialog',
      profile: 'overlay',
      control: 'value',
      capabilities: overlayMetadata.capabilities ?? [],
      parts: ['Root', 'Trigger', 'Content'],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );

    const result = checkTestCoverageContract({
      contractFile,
      testFile,
      metadata: overlayMetadata,
      platform: 'react',
    });

    expect(result.ok).toBe(false);
    expect(result.details).toContain('Missing manual component-specific tests');
    expect(result.details).toContain('focus-management, portal');
  });

  it('includes the exact manual test path when the coverage marker is stale', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Dialog.test-contract.json');
    const testFile = path.join(root, 'Dialog.test.tsx');
    const manualTestFile = path.join(root, 'Dialog.manual.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Dialog',
      profile: 'overlay',
      control: 'value',
      capabilities: overlayMetadata.capabilities ?? [],
      parts: ['Root', 'Trigger', 'Content'],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );
    fs.writeFileSync(manualTestFile, '// missing coverage marker\n');

    const result = checkTestCoverageContract({
      contractFile,
      testFile,
      metadata: overlayMetadata,
      platform: 'react',
    });

    expect(result.ok).toBe(false);
    expect(result.details).toContain(manualTestFile);
    expect(result.details).toContain(
      '// Coverage contract: focus-management, portal'
    );
  });

  it('rejects a generated manual scaffold that has a marker but no test case', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Dialog.test-contract.json');
    const testFile = path.join(root, 'Dialog.test.tsx');
    const manualTestFile = path.join(root, 'Dialog.manual.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Dialog',
      profile: 'overlay',
      control: 'value',
      capabilities: overlayMetadata.capabilities ?? [],
      parts: ['Root', 'Trigger', 'Content'],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );
    fs.writeFileSync(
      manualTestFile,
      '// Coverage contract: focus-management, portal\n' +
        "describe('manual behavior coverage', () => {});\n"
    );

    const result = checkTestCoverageContract({
      contractFile,
      testFile,
      metadata: overlayMetadata,
      platform: 'react',
    });

    expect(result.ok).toBe(false);
    expect(result.details).toContain('no executable test evidence');
    expect(result.details).toContain(manualTestFile);
  });

  it('passes when required manual overlay coverage is explicitly tested', () => {
    const root = createRoot();
    const contractFile = path.join(root, 'Dialog.test-contract.json');
    const testFile = path.join(root, 'Dialog.test.tsx');
    const manualTestFile = path.join(root, 'Dialog.behavior.manual.test.tsx');
    const contract = createComponentTestCoverageContract({
      componentName: 'Dialog',
      profile: 'overlay',
      control: 'value',
      capabilities: overlayMetadata.capabilities ?? [],
      parts: ['Root', 'Trigger', 'Content'],
      isNative: false,
    });

    fs.writeFileSync(
      contractFile,
      renderComponentTestCoverageContract(contract)
    );
    fs.writeFileSync(
      testFile,
      `// Baseline contract: ${contract.baseline.requirements.join(', ')}\n`
    );
    fs.writeFileSync(
      manualTestFile,
      '// Coverage contract: focus-management, portal\n' +
        "it('covers the declared manual behavior', () => {});\n"
    );

    expect(
      checkTestCoverageContract({
        contractFile,
        testFile,
        metadata: overlayMetadata,
        platform: 'react',
      })
    ).toEqual({ name: 'tests', platform: 'react', ok: true });
  });
});
