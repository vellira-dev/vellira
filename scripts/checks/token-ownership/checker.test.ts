import { describe, expect, it } from 'vitest';

import {
  componentTokenLifecycle,
  semanticTokenLifecycle,
} from '@vellira-ui/metadata';

import { checkTokenOwnership } from './checker';

const toComponentFamily = (componentName: string) =>
  `${componentName[0]?.toLowerCase() ?? ''}${componentName.slice(1)}`;

describe('token ownership checker', () => {
  it('keeps the checked-in token authority baseline free of ownership drift', () => {
    const report = checkTokenOwnership(process.cwd());

    expect(report.schemaVersion).toBe(1);
    expect(report.findings).toEqual([]);
  });

  it('reports exactly the lifecycle entries that remain public', () => {
    const report = checkTokenOwnership(process.cwd());
    const expectedComponentFamilies = Object.entries(componentTokenLifecycle)
      .filter(([, lifecycle]) => lifecycle.public)
      .map(([name]) => toComponentFamily(name))
      .sort();
    const expectedSemanticNamespaces = Object.entries(semanticTokenLifecycle)
      .filter(([, lifecycle]) => lifecycle.public)
      .map(([name]) => name)
      .sort();

    expect(report.componentFamilies).toEqual(expectedComponentFamilies);
    expect(report.semanticNamespaces).toEqual(expectedSemanticNamespaces);
  });

  it('keeps ContextMenu compatibility explicit and navigation tombstoned', () => {
    expect(componentTokenLifecycle.ContextMenu).toMatchObject({
      status: 'deprecated',
      public: true,
      owner: 'token-compatibility',
    });
    expect(semanticTokenLifecycle.navigation).toMatchObject({
      status: 'deprecated',
      public: false,
      authority: 'compatibility',
      owner: 'removed-semantic-tombstone',
    });

    const report = checkTokenOwnership(process.cwd());
    expect(report.componentFamilies).toContain('contextMenu');
    expect(report.semanticNamespaces).not.toContain('navigation');
  });
});
