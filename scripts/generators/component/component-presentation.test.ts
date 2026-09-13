import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  deriveComponentPresentationScenarios,
  readCanonicalComponentCapabilities,
} from '../component-presentation';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component presentation scenarios', () => {
  it('keeps a base component on a useful basic baseline', () => {
    expect(
      deriveComponentPresentationScenarios({
        profile: 'base',
        capabilities: [],
      })
    ).toEqual(['basic']);
  });

  it('derives form-control states deterministically from capabilities', () => {
    expect(
      deriveComponentPresentationScenarios({
        profile: 'form-control',
        capabilities: [
          'invalid',
          'controlled',
          'required',
          'uncontrolled',
          'disabled',
        ],
      })
    ).toEqual([
      'basic',
      'controlled',
      'uncontrolled',
      'disabled',
      'required',
      'invalid',
    ]);
  });

  it('derives production compound coverage without component-name rules', () => {
    expect(
      deriveComponentPresentationScenarios({
        profile: 'compound',
        capabilities: [
          'compound-api',
          'multiple',
          'controlled',
          'uncontrolled',
          'collapsible',
          'disabled',
        ],
      })
    ).toEqual([
      'basic',
      'multiple',
      'controlled',
      'uncontrolled',
      'collapsible',
      'disabled',
      'rich-content',
    ]);
  });

  it('reads the canonical capability authority used by website generation', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-component-presentation-')
    );
    tempRoots.push(root);

    const metadataDir = path.join(
      root,
      'packages/metadata/src/components'
    );
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.writeFileSync(
      path.join(metadataDir, 'Accordion.metadata.ts'),
      `export const metadata = {
  capabilities: ['compound-api', 'multiple', 'collapsible'],
};
`
    );

    expect(
      readCanonicalComponentCapabilities({
        root,
        componentName: 'Accordion',
      })
    ).toEqual(['compound-api', 'multiple', 'collapsible']);
  });
});
