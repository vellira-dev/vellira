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
  it('accepts a complete, platform-scoped contract', () => {
    expect(check(complete)).toEqual([]);
  });

  it('rejects a missing or status-only discovery object', () => {
    expect(check(undefined)).toContain('discovery metadata is required');
    expect(check({ status: 'complete' })).toEqual(
      expect.arrayContaining([
        'discovery.summary must be non-empty',
        'discovery.description must be non-empty',
        'discovery.whenToUse must contain useful guidance',
        'discovery.patterns must contain a developer pattern',
      ])
    );
  });

  it('does not mark basic-only usage or unresolved evidence complete', () => {
    const result = check({
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

    expect(result).toContain(
      'complete discovery needs a non-basic developer pattern'
    );
    expect(result).toContain(
      'complete discovery cannot have unresolved evidence'
    );
  });

  it('rejects empty and duplicate developer patterns', () => {
    expect(
      check({
        ...complete,
        patterns: [
          complete.patterns?.[0] ?? {},
          complete.patterns?.[0] ?? {},
        ],
      })
    ).toContain('duplicate discovery pattern id: controlled');
    expect(
      check({
        ...complete,
        patterns: [{ id: 'controlled', title: '  ', description: '' }],
      })
    ).toContain('discovery.patterns[0] is incomplete');
  });

  it('requires explicit platform boundary notes', () => {
    expect(
      check({ ...complete, platformNotes: { react: ['Web semantics.'] } })
    ).toContain(
      'discovery.platformNotes.react-native must describe the platform boundary'
    );
  });

  it('allows unresolved experimental intent, but blocks Stable graduation', () => {
    const unresolved: DiscoveryContentCandidate = {
      ...complete,
      status: 'needs-authored-intent',
      patterns: [
        {
          id: 'basic',
          title: 'Basic',
          description: 'Basic usage.',
        },
      ],
      missingEvidence: ['Missing verified developer task intent.'],
    };

    expect(check(unresolved, false)).toEqual([]);
    expect(check(unresolved, true)).toContain(
      'Stable component requires complete discovery content'
    );
    expect(
      check({ ...unresolved, missingEvidence: [] }, false)
    ).toContain('incomplete discovery must explain missing evidence');
  });

  it('keeps legacy exemptions explicit, bounded and unique', () => {
    expect(new Set(LEGACY_DISCOVERY_COMPONENTS).size).toBe(
      LEGACY_DISCOVERY_COMPONENTS.length
    );
    expect(LEGACY_DISCOVERY_COMPONENTS).not.toContain('Button');
    expect(LEGACY_DISCOVERY_COMPONENTS).not.toContain('Checkbox');
    expect(LEGACY_DISCOVERY_COMPONENTS).not.toContain('Input');
    expect(LEGACY_DISCOVERY_COMPONENTS).not.toContain('Textarea');
  });
});
