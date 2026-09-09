import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  componentMetadata,
  componentTokenLifecycle,
  getComponentTokenLifecycle,
} from '@vellira-ui/metadata';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertComponentTokenLifecycleCanMaterialize,
  checkComponentTokenLifecycleContract,
  ensureComponentTokenLifecycleContract,
  getTokenLifecycleRegistryFile,
  needsComponentTokenLifecycleMutation,
} from './token-lifecycle-contract';

import { createComponentGenerationPlan } from './plan';
import {
  copyTokenLifecycleFixture,
  mutateTokenLifecycleFixture,
  reserveTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';
import { readTokenLifecycleAuthority } from '../../token-lifecycle/authority';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
function fixture(componentName = 'FutureExample') {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-token-lifecycle-')
  );
  roots.push(root);
  copyTokenLifecycleFixture(root);
  const plan = createComponentGenerationPlan({
    root,
    options: {
      componentName,
      platform: 'both',
      layer: 'primitives',
      category: 'utility',
      profile: 'base',
      componentTokens: 'standard',
      parts: [],
      force: false,
    },
  });
  return { root, plan, file: getTokenLifecycleRegistryFile(root) };
}

describe('Generator V2 token ownership authority', () => {
  it('keeps every current metadata-backed token family aligned with componentMetadata', () => {
    const tokenMetadata = componentMetadata.filter(
      (metadata) => metadata.requirements?.componentTokens !== false
    );
    const metadataNames = tokenMetadata.map((metadata) => metadata.name).sort();
    const currentMetadataOwners = Object.entries(componentTokenLifecycle)
      .filter(
        ([, lifecycle]) => lifecycle.status === 'current' && lifecycle.public
      )
      .map(([name]) => name)
      .sort();

    expect(currentMetadataOwners).toEqual(metadataNames);

    for (const metadata of tokenMetadata) {
      expect(getComponentTokenLifecycle(metadata.name)).toMatchObject({
        status: 'current',
        public: true,
        owner: metadata.name,
      });
    }
  });

  it('does not invent ContextMenu metadata ownership', () => {
    expect(componentMetadata.map((metadata) => metadata.name)).not.toContain(
      'ContextMenu'
    );
    expect(getComponentTokenLifecycle('ContextMenu')).toMatchObject({
      status: 'deprecated',
      public: true,
      owner: 'token-compatibility',
    });
  });

  it('allows Generator V2 to maintain current registered families', () => {
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('Button')
    ).not.toThrow();
    expect(needsComponentTokenLifecycleMutation('Button')).toBe(false);
  });

  it('blocks Generator V2 from silently reviving deprecated families', () => {
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('ContextMenu')
    ).toThrow(/deprecated-component-token-family/);
  });

  it('fails closed for an unregistered future family', () => {
    expect(getComponentTokenLifecycle('FutureExample')).toBeUndefined();
    expect(needsComponentTokenLifecycleMutation('FutureExample')).toBe(false);
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('FutureExample')
    ).toThrow(/unregistered-component-token-family/);
  });
});

describe('Generator V2 lifecycle source transitions', () => {
  it.each(['FutureExample', 'ContextMenu', 'constructor', 'toString'])(
    'rejects %s without creating or mutating an entry',
    (name) => {
      const { root, plan, file } = fixture(name);
      const before = fs.readFileSync(file, 'utf8');
      const result = { updatedFiles: [] as string[] };
      expect(() =>
        ensureComponentTokenLifecycleContract({ plan, result })
      ).toThrow(/unregistered|deprecated/);
      expect(fs.readFileSync(file, 'utf8')).toBe(before);
      expect(result.updatedFiles).toEqual([]);
      expect(getComponentTokenLifecycle(name)).toEqual(
        name === 'ContextMenu' ? componentTokenLifecycle.ContextMenu : undefined
      );
      expect(checkComponentTokenLifecycleContract(plan)).toEqual([
        path.relative(root, file),
      ]);
      expect(fs.readFileSync(file, 'utf8')).toBe(before);
    }
  );

  it('promotes only an explicit source reservation, without relying on rebuilt metadata', () => {
    const { root, plan, file } = fixture();
    reserveTokenLifecycleFixture(root, plan.componentName);
    const before = readTokenLifecycleAuthority(root);
    expect(needsComponentTokenLifecycleMutation(plan.componentName, root)).toBe(
      true
    );
    expect(checkComponentTokenLifecycleContract(plan)).toEqual([
      path.relative(root, file),
    ]);
    expect(fs.readFileSync(file, 'utf8')).toBe(before.source);
    const result = { updatedFiles: [] as string[] };
    ensureComponentTokenLifecycleContract({ plan, result });
    const after = readTokenLifecycleAuthority(root);
    expect(after.components).toEqual({
      ...before.components,
      FutureExample: { ...before.components.FutureExample, status: 'current' },
    });
    expect(after.semantics).toEqual(before.semantics);
    expect(result.updatedFiles).toEqual([file]);
    expect(checkComponentTokenLifecycleContract(plan)).toEqual([]);
    expect(needsComponentTokenLifecycleMutation(plan.componentName, root)).toBe(
      false
    );
    ensureComponentTokenLifecycleContract({ plan, result });
    expect(fs.readFileSync(file, 'utf8')).toBe(after.source);
    expect(result.updatedFiles).toEqual([file]);
  });

  it.each(['reserved', 'current'] as const)(
    'rejects invalid %s ownership and public state without writes',
    (status) => {
      for (const invalid of [{ owner: 'SomeoneElse' }, { public: false }]) {
        const { root, plan, file } = fixture();
        reserveTokenLifecycleFixture(root, plan.componentName);
        mutateTokenLifecycleFixture(root, ({ components }) => {
          Object.assign(components.FutureExample, { status }, invalid);
        });
        const before = fs.readFileSync(file, 'utf8');
        expect(() =>
          ensureComponentTokenLifecycleContract({
            plan,
            result: { updatedFiles: [] },
          })
        ).toThrow(new RegExp(`invalid-${status}-component-token-family`));
        expect(checkComponentTokenLifecycleContract(plan)).toEqual([
          path.relative(root, file),
        ]);
        expect(fs.readFileSync(file, 'utf8')).toBe(before);
      }
    }
  );

  it('detects lifecycle edits made after a prior check without mutating them', () => {
    const { root, plan, file } = fixture('Button');
    expect(checkComponentTokenLifecycleContract(plan)).toEqual([]);
    mutateTokenLifecycleFixture(root, ({ components }) => {
      components.Button.status = 'deprecated';
    });
    const before = fs.readFileSync(file, 'utf8');
    expect(checkComponentTokenLifecycleContract(plan)).toEqual([
      path.relative(root, file),
    ]);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});
