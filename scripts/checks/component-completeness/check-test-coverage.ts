import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';
import {
  componentTestCoverageContractVersion,
  createComponentTestCoverageContract,
  type ComponentTestCoverageContract,
} from '../../generators/component/coverage-contract';

import type { ComponentCheckResult } from './types';

function expectedContractPlatform(platform: ComponentPlatform) {
  return platform === 'react' ? ('web' as const) : ('native' as const);
}

function sameRequirements(
  actual: readonly string[],
  expected: readonly string[]
) {
  return (
    actual.length === expected.length &&
    actual.every((requirement, index) => requirement === expected[index])
  );
}

function collectManualTestFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectManualTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.manual.test.tsx')) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function hasExecutableManualEvidence(source: string) {
  return /\b(?:it|test)(?:\.each)?\s*\(/.test(source);
}

function validateManualCoverage(params: {
  componentDir: string;
  requirements: readonly string[];
  platform: ComponentPlatform;
}): ComponentCheckResult | undefined {
  const { componentDir, requirements, platform } = params;

  if (requirements.length === 0) {
    return undefined;
  }

  const manualTests = collectManualTestFiles(componentDir);

  if (manualTests.length === 0) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Missing manual component-specific tests for: ${requirements.join(', ')}. Add a *.manual.test.tsx file with the coverage contract marker.`,
    };
  }

  const combinedSource = manualTests
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const expectedMarker = `// Coverage contract: ${requirements.join(', ')}`;

  if (!combinedSource.includes(expectedMarker)) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Manual test coverage is missing the required marker in ${manualTests.join(', ')}. Expected marker: ${expectedMarker}`,
    };
  }

  if (!hasExecutableManualEvidence(combinedSource)) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Manual test coverage marker is present but no executable test evidence was found in ${manualTests.join(', ')}. Add at least one it(...) or test(...) case for: ${requirements.join(', ')}.`,
    };
  }

  return undefined;
}

export function checkTestCoverageContract(params: {
  contractFile: string;
  testFile: string;
  metadata: ComponentMetadata;
  platform: ComponentPlatform;
}): ComponentCheckResult {
  const { contractFile, testFile, metadata, platform } = params;

  if (!fs.existsSync(contractFile)) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Missing test coverage contract: ${contractFile}`,
    };
  }

  if (!fs.existsSync(testFile)) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Missing test file required by coverage contract: ${testFile}`,
    };
  }

  let contract: ComponentTestCoverageContract;

  try {
    contract = JSON.parse(
      fs.readFileSync(contractFile, 'utf8')
    ) as ComponentTestCoverageContract;
  } catch {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Invalid test coverage contract JSON: ${contractFile}`,
    };
  }

  if (contract.version !== componentTestCoverageContractVersion) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Unsupported test coverage contract version in ${contractFile}`,
    };
  }

  if (contract.component !== metadata.name) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Test coverage contract component drift in ${contractFile}: expected ${metadata.name}, received ${contract.component}`,
    };
  }

  const expectedPlatform = expectedContractPlatform(platform);

  if (contract.platform !== expectedPlatform) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Test coverage contract platform drift in ${contractFile}: expected ${expectedPlatform}, received ${contract.platform}`,
    };
  }

  if (contract.profile !== metadata.profile) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Test coverage contract profile drift in ${contractFile}: expected ${metadata.profile}, received ${contract.profile}`,
    };
  }

  const expectedContract = createComponentTestCoverageContract({
    componentName: metadata.name,
    profile: metadata.profile,
    control: contract.control,
    capabilities: metadata.capabilities ?? [],
    parts: contract.parts ?? [],
    isNative: platform === 'react-native',
  });

  if (
    !sameRequirements(
      contract.baseline.requirements,
      expectedContract.baseline.requirements
    )
  ) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Test coverage contract requirements drift in ${contractFile}. Regenerate baseline tests for ${metadata.name}.`,
    };
  }

  if (
    !sameRequirements(
      contract.componentSpecific.requirements ?? [],
      expectedContract.componentSpecific.requirements
    )
  ) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Manual test coverage requirements drift in ${contractFile}. Regenerate the coverage contract for ${metadata.name}.`,
    };
  }

  const testSource = fs.readFileSync(testFile, 'utf8');
  const expectedMarker = `// Baseline contract: ${expectedContract.baseline.requirements.join(', ')}`;

  if (!testSource.includes(expectedMarker)) {
    return {
      name: 'tests',
      platform,
      ok: false,
      details: `Generated baseline test contract is stale in ${testFile}. Expected marker: ${expectedMarker}`,
    };
  }

  const manualCoverageFailure = validateManualCoverage({
    componentDir: path.dirname(testFile),
    requirements: expectedContract.componentSpecific.requirements,
    platform,
  });

  if (manualCoverageFailure) {
    return manualCoverageFailure;
  }

  return {
    name: 'tests',
    platform,
    ok: true,
  };
}
