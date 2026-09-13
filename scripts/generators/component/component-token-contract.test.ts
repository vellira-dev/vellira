import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkComponentTokenContract,
  ensureComponentTokenContract,
} from './component-token-contract';
import { createComponentGenerationPlan } from './plan';

const roots: string[] = [];

function createPlan() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-token-contract-')
  );
  roots.push(root);

  return createComponentGenerationPlan({
    root,
    options: {
      componentName: 'Disclosure',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      capabilities: ['compound-api'],
      parts: ['Root', 'Item', 'Trigger', 'Content'],
      force: false,
    },
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component token contract', () => {
  it('materializes factory and all theme targets for compound components', async () => {
    const plan = createPlan();
    const result = {
      createdFiles: [] as string[],
      updatedFiles: [] as string[],
    };

    expect((await checkComponentTokenContract(plan)).length).toBeGreaterThan(0);

    ensureComponentTokenContract({ plan, result });

    expect(await checkComponentTokenContract(plan)).toEqual([]);
    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(true);
    expect(result.createdFiles).toContain(plan.tokenFactoryFile);

    for (const target of plan.tokenThemeTargets) {
      expect(fs.existsSync(target.componentFile)).toBe(true);
      expect(result.createdFiles).toContain(target.componentFile);
    }
  });

  it('preserves semantic token files on repeated reconciliation', async () => {
    const plan = createPlan();
    const result = {
      createdFiles: [] as string[],
      updatedFiles: [] as string[],
    };

    ensureComponentTokenContract({ plan, result });
    fs.writeFileSync(
      plan.tokenFactoryFile,
      '// custom semantic token contract\n'
    );

    ensureComponentTokenContract({
      plan,
      result: { createdFiles: [], updatedFiles: [] },
    });

    expect(fs.readFileSync(plan.tokenFactoryFile, 'utf8')).toBe(
      '// custom semantic token contract\n'
    );
    expect(await checkComponentTokenContract(plan)).toEqual([
      path.relative(plan.root, plan.tokenFactoryFile),
    ]);
  });

  it('recognizes the production Accordion disclosure contract as canonical', async () => {
    const plan = createComponentGenerationPlan({
      root: process.cwd(),
      options: {
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        capabilities: [
          'controlled',
          'uncontrolled',
          'disabled',
          'keyboard',
          'compound-api',
        ],
        componentTokens: 'disclosure',
        parts: ['Root', 'Item', 'Trigger', 'Content'],
        force: true,
      },
    });

    expect(await checkComponentTokenContract(plan)).toEqual([]);
  });

  it('treats explicit tokenless intent as auditable N/A', async () => {
    const plan = createComponentGenerationPlan({
      root: fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-tokenless-')),
      options: {
        componentName: 'TokenlessProbe',
        platform: 'both',
        layer: 'components',
        category: 'utility',
        profile: 'compound',
        componentTokens: false,
        parts: ['Root'],
        force: false,
      },
    });
    roots.push(plan.root);

    const result = {
      createdFiles: [] as string[],
      updatedFiles: [] as string[],
    };

    ensureComponentTokenContract({ plan, result });

    expect(result).toEqual({ createdFiles: [], updatedFiles: [] });
    expect(await checkComponentTokenContract(plan)).toEqual([]);
    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(false);
  });
});
