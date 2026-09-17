import { describe, expect, it } from 'vitest';

import { validateComponentIntentTarget } from './componentIntent';
import { componentMetadata } from './components';
import type { ComponentExpansionTarget } from './expansion';
import { componentExpansionCatalog } from './expansionCatalog';
import { getComponentExpansionReport } from './expansionReport';

describe('componentExpansionCatalog', () => {
  it('uses stable unique component names', () => {
    const names = componentExpansionCatalog.map((target) => target.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('declares at least one supported platform and valid V1 intent for every target', () => {
    for (const target of componentExpansionCatalog) {
      expect(target.platforms.length).toBeGreaterThan(0);
      expect(target.intent.schemaVersion).toBe('1');
      expect(target.intent.job.length).toBeGreaterThan(0);
      expect(validateComponentIntentTarget(target)).toEqual([]);

      for (const platform of target.platforms) {
        expect(['react', 'react-native']).toContain(platform);
      }
    }
  });

  it('keeps all six remaining launch components in public intent authority', () => {
    const names = new Set(
      componentExpansionCatalog.map((target) => target.name)
    );

    for (const name of [
      'Textarea',
      'Avatar',
      'Badge',
      'Progress',
      'Skeleton',
      'Toast',
    ]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('references known components when representedBy or dependsOn are used', () => {
    const knownNames = new Set<string>(
      componentMetadata.map((metadata) => metadata.name)
    );

    for (const catalogTarget of componentExpansionCatalog) {
      const target: ComponentExpansionTarget = catalogTarget;

      for (const representedName of target.representedBy ?? []) {
        expect(knownNames.has(representedName)).toBe(true);
      }

      for (const dependencyName of target.dependsOn ?? []) {
        expect(knownNames.has(dependencyName)).toBe(true);
      }
    }
  });

  it('produces a versioned machine-readable report', () => {
    expect(getComponentExpansionReport()).toEqual({
      schemaVersion: '1',
      components: componentMetadata,
      targets: componentExpansionCatalog,
    });
  });
});
