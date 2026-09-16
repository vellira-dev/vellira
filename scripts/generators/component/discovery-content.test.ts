import { describe, expect, it } from 'vitest';

import { deriveComponentDiscoveryContent } from './discovery-content';

describe('deriveComponentDiscoveryContent', () => {
  it('derives capability-grounded form-control discovery content', () => {
    const content = deriveComponentDiscoveryContent({
      componentName: 'FixtureControl',
      category: 'form',
      profile: 'form-control',
      capabilities: [
        'controlled',
        'uncontrolled',
        'disabled',
        'required',
        'invalid',
      ],
      platforms: ['react', 'react-native'],
    });

    expect(content.status).toBe('complete');
    expect(content.description).toContain('controlled and uncontrolled state');
    expect(content.patterns.map((pattern) => pattern.id)).toEqual([
      'basic',
      'controlled',
      'uncontrolled',
      'disabled',
      'required',
      'invalid',
    ]);
    expect(content.whenToUse).toHaveLength(2);
    expect(content.platformNotes.react?.join(' ')).toContain('ARIA');
    expect(content.platformNotes['react-native']?.join(' ')).toContain(
      'native rendering'
    );
    expect(content.missingEvidence).toEqual([]);
  });

  it('derives compound composition from generic capability evidence', () => {
    const content = deriveComponentDiscoveryContent({
      componentName: 'FixtureCompound',
      category: 'navigation',
      profile: 'compound',
      capabilities: ['compound-api', 'controlled', 'uncontrolled', 'keyboard'],
      platforms: ['react'],
    });

    expect(content.status).toBe('complete');
    expect(content.patterns.map((pattern) => pattern.id)).toContain(
      'rich-content'
    );
    expect(content.description).toContain('compound composition');
    expect(content.description).toContain('keyboard interaction');
  });

  it('fails closed when only generic basic usage can be inferred', () => {
    const content = deriveComponentDiscoveryContent({
      componentName: 'FixtureDisplay',
      category: 'data-display',
      profile: 'base',
      capabilities: [],
      platforms: ['react'],
    });

    expect(content.status).toBe('needs-authored-intent');
    expect(content.patterns.map((pattern) => pattern.id)).toEqual(['basic']);
    expect(content.missingEvidence).toEqual([
      'No capability-grounded developer pattern is available beyond basic usage.',
    ]);
  });

  it('does not infer unsupported platform claims', () => {
    const content = deriveComponentDiscoveryContent({
      componentName: 'NativeOnlyControl',
      category: 'form',
      profile: 'form-control',
      capabilities: ['controlled'],
      platforms: ['react-native'],
    });

    expect(content.summary).toContain('React Native');
    expect(content.summary).not.toContain('React and React Native');
    expect(content.platformNotes.react).toBeUndefined();
    expect(content.platformNotes['react-native']).toBeDefined();
  });
});
