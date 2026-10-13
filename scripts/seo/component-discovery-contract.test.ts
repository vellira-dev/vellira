import { describe, expect, it } from 'vitest';

import {
  getDiscoveryContentFindings,
  LEGACY_DISCOVERY_COMPONENTS,
  type DiscoveryContentCandidate,
} from './component-discovery-contract';

const complete: DiscoveryContentCandidate = {
  status: 'complete',
  summary: 'Use this control for explicit form participation.',
  description: 'A reusable form control with verified platform behavior.',
  whenToUse: ['Use it when the form requires a boolean choice.'],
  patterns: [
    {
      id: 'controlled',
      title: 'Controlled state',
      description: 'Application state owns the selected value.',
    },
  ],
  platformNotes: {
    react: ['React interaction follows browser semantics.'],
    'react-native': ['Native controls use platform accessibility APIs.'],
  },
  missingEvidence: [],
};

function check(
  discovery: DiscoveryContentCandidate | undefined,
  stable = true
) {
  return getDiscoveryContentFindings({
    discovery,
    stable,
    platforms: ['react', 'react-native'],
  });
}

describe('Component Discovery Content V1 coverage', () => {
  it('accepts a complete platform-scoped contract', () => {
    expect(check(complete)).toEqual([]);
  });

  it('requires adopted discovery metadata', () => {
    expect(check(undefined)).toContain('discovery metadata is required');
    const issues = check({ status: 'complete' });
    expect(issues).toContain('discovery.summary must be non-empty');
    expect(issues).toContain('discovery.description must be non-empty');
    expect(issues).toContain(
      'discovery.whenToUse must contain useful guidance'
    );
    expect(issues).toContain(
      'discovery.patterns must contain a developer pattern'
    );
  });

  it('rejects basic-only and unresolved complete content', () => {
    const issues = check({
      ...complete,
      patterns: [
        {
          id: 'basic',
          title: 'Basic',
          description: 'Basic component usage.',
        },
      ],
      missingEvidence: ['No supported task intent.'],
    });
    const nonBasic = 'complete discovery needs a non-basic developer pattern';
    const evidenceError = 'complete discovery cannot have unresolved evidence';
    expect(issues).toContain(nonBasic);
    expect(issues).toContain(evidenceError);
  });

  it('rejects duplicate and empty patterns', () => {
    const pattern = {
      id: 'controlled',
      title: 'Controlled state',
      description: 'App state owns the value.',
    };
    const duplicates = check({ ...complete, patterns: [pattern, pattern] });
    const invalid = check({
      ...complete,
      patterns: [{ id: 'controlled', title: ' ', description: '' }],
    });
    expect(duplicates).toContain('duplicate discovery pattern id: controlled');
    expect(invalid).toContain('discovery.patterns[0] is incomplete');
  });

  it('requires per-platform guidance', () => {
    const issues = check({
      ...complete,
      platformNotes: { react: ['Web semantics.'] },
    });
    expect(issues).toContain(
      'missing discovery platform notes for react-native'
    );
  });

  it('blocks Stable graduation with unresolved intent', () => {
    const unresolved: DiscoveryContentCandidate = {
      ...complete,
      status: 'needs-authored-intent',
      patterns: [{ id: 'basic', title: 'Basic', description: 'Basic usage.' }],
      missingEvidence: ['Missing verified developer intent.'],
    };
    expect(check(unresolved, false)).toEqual([]);
    const blocked = check(unresolved, true);
    expect(blocked).toContain(
      'Stable component requires complete discovery content'
    );
    const noEvidence = check({ ...unresolved, missingEvidence: [] }, false);
    expect(noEvidence).toContain(
      'incomplete discovery must explain missing evidence'
    );
  });

  it('records bounded legacy exemptions', () => {
    const names = LEGACY_DISCOVERY_COMPONENTS;
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('Button');
    expect(names).not.toContain('Checkbox');
    expect(names).not.toContain('Input');
    expect(names).not.toContain('Textarea');
  });
});
