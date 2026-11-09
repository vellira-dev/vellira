import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { compileProductionProgram } from './cli';
import { programDigest } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import type { ComponentProgramDecisionsV1 } from '../../packages/metadata/src/componentProgram';

type Source = ReturnType<typeof mediaSpec>;

const avatarSource = JSON.parse(
  fs.readFileSync('scripts/component-production/specs/Avatar.json', 'utf8')
) as Source;
const avatarPlanning = JSON.parse(
  fs.readFileSync(
    'scripts/component-production/specs/Avatar.planning.json',
    'utf8'
  )
) as {
  evidenceId: string;
  risk: string;
  supportedCapabilities: string[];
  apiMembers: {
    name: string;
    type: string;
    required: boolean;
    scope: string;
  }[];
  obligations: {
    id: string;
    kind: string;
    capability: string;
    platformScope: string[];
    consequence: string;
  }[];
};

const mediaPresentation = {
  id: 'media-presentation',
  platforms: ['react', 'react-native'] as const,
  bindings: {},
  parameters: {
    'default-size': 'md',
    'image-fit': 'cover',
    'fallback-overflow': 'truncate',
  },
};

function genericMediaSource(): Source {
  return {
    ...mediaSpec(),
    componentProgram: {
      ...mediaProgram(),
      modules: [...mediaProgram().modules, mediaPresentation],
    },
  };
}

describe('versioned generic image presentation and Avatar source contract', () => {
  it('compiles the real Avatar source with independently reviewable fallback pixels and media defaults', () => {
    const result = compileProductionProgram(avatarSource);
    expect(result.disposition).toBe('compiled');
    expect(result.findings).toEqual([]);
    expect(result.fingerprint).toMatch(/^component-program-v1:[0-9a-f]{64}$/);
    const program = result.program!;
    const module = program.decisions.modules.find(
      (item) => item.id === 'media-presentation'
    );
    expect(module?.parameters).toEqual(mediaPresentation.parameters);

    for (const platform of ['react', 'react-native']) {
      for (const id of [
        'image-source:stale-request-proof',
        'image-fallback:unobscured',
        'image-fallback:loaded-replacement',
        'image-fallback:accessible-fallback',
        'media-presentation:approved-appearance',
        'media-presentation:size-and-overflow',
      ]) {
        expect(
          program.obligations.some(
            (item) =>
              item.id === id &&
              item.platform === platform &&
              item.evaluation === 'human-review' &&
              item.ruleId === null
          ),
          `Missing independent candidate evidence: ${platform}:${id}`
        ).toBe(true);
      }
    }
    const visual = program.obligations.find(
      (item) => item.id === 'image-fallback:unobscured'
    );
    expect(visual?.statement).toContain('browser broken-image indicator');
    expect(visual?.statement).toContain('no-source');
  });

  it('preserves the recorded historical V1 media serialization when no successor module is selected', () => {
    const baseline = JSON.parse(
      fs.readFileSync(
        'scripts/component-program/fixtures/flat-callback-baseline.json',
        'utf8'
      )
    ).media as { fingerprint: string; serialization: string };
    const legacy = compileProductionProgram(mediaSpec());
    const successor = compileProductionProgram(genericMediaSource());
    expect(legacy.disposition).toBe('compiled');
    expect(legacy.fingerprint).toBe(baseline.fingerprint);
    expect(programDigest('baseline', legacy)).toBe(baseline.serialization);
    expect(successor.disposition).toBe('compiled');
    expect(successor.fingerprint).not.toBe(legacy.fingerprint);
    expect(successor.program?.grammarFingerprint).not.toBe(
      legacy.program?.grammarFingerprint
    );
  });

  it('reuses presentation semantics for a different named component, without assuming Avatar identity', () => {
    const result = compileProductionProgram(genericMediaSource());
    expect(result.disposition).toBe('compiled');
    expect(
      result.program?.decisions.modules.some(
        (item) => item.id === 'media-presentation'
      )
    ).toBe(true);
    expect(compileProductionProgram(mediaSpec()).disposition).toBe('compiled');
  });

  it.each([
    [
      'default size',
      {
        'default-size': 'xl',
        'image-fit': 'cover',
        'fallback-overflow': 'truncate',
      },
    ],
    [
      'image fit',
      {
        'default-size': 'md',
        'image-fit': 'stretch',
        'fallback-overflow': 'truncate',
      },
    ],
    [
      'fallback overflow',
      {
        'default-size': 'md',
        'image-fit': 'cover',
        'fallback-overflow': 'wrap',
      },
    ],
    [
      'missing default',
      { 'image-fit': 'cover', 'fallback-overflow': 'truncate' },
    ],
    ['missing fit', { 'default-size': 'md', 'fallback-overflow': 'truncate' }],
    ['missing overflow', { 'default-size': 'md', 'image-fit': 'cover' }],
    [
      'unknown policy',
      {
        'default-size': 'md',
        'image-fit': 'cover',
        'fallback-overflow': 'truncate',
        invented: 'yes',
      },
    ],
  ])(
    'refuses unsafe or guessed media-presentation decision: %s',
    (_, parameters) => {
      const source = genericMediaSource();
      const decisions = source.componentProgram!;
      source.componentProgram = {
        ...decisions,
        modules: decisions.modules.map((item) =>
          item.id === 'media-presentation' ? { ...item, parameters } : item
        ),
      } as ComponentProgramDecisionsV1;
      expect(compileProductionProgram(source).disposition).not.toBe('compiled');
    }
  );

  it('rejects media presentation if fallback or size ownership is missing', () => {
    for (const removed of ['image-fallback', 'size-variants', 'image-source']) {
      const source = genericMediaSource();
      const decisions = source.componentProgram!;
      source.componentProgram = {
        ...decisions,
        modules: decisions.modules.filter((module) => module.id !== removed),
      };
      const result = compileProductionProgram(source);
      expect(result.disposition).not.toBe('compiled');
      expect(
        result.findings.some((item) => item.reason.includes('Requires'))
      ).toBe(true);
    }
  });

  it('changes the canonical Program identity for each approved presentation policy', () => {
    const first = compileProductionProgram(genericMediaSource());
    for (const [key, replacement] of [
      ['default-size', 'sm'],
      ['image-fit', 'contain'],
      ['fallback-overflow', 'clip'],
    ]) {
      const source = genericMediaSource();
      const decisions = source.componentProgram!;
      source.componentProgram = {
        ...decisions,
        modules: decisions.modules.map((item) =>
          item.id === 'media-presentation'
            ? {
                ...item,
                parameters: {
                  ...mediaPresentation.parameters,
                  [key]: replacement,
                },
              }
            : item
        ),
      };
      const changed = compileProductionProgram(source);
      expect(changed.disposition).toBe('compiled');
      expect(changed.fingerprint).not.toBe(first.fingerprint);
    }
  });

  it('binds Avatar-only geometry, accessible name and target risk in tracked planning evidence', () => {
    expect(avatarPlanning.evidenceId).toBe('avatar-api-program-v2');
    expect(avatarPlanning.risk).toBe('medium');
    expect(avatarPlanning.supportedCapabilities).toEqual(
      expect.arrayContaining([
        'image-source',
        'fallback',
        'accessible-name',
        'size-variants',
      ])
    );
    expect(avatarPlanning.apiMembers.map((member) => member.name)).toEqual([
      'name',
      'fallback',
      'size',
      'source',
      'source',
    ]);
    expect(
      avatarPlanning.apiMembers
        .filter((member) => member.name === 'source')
        .map((member) => [member.scope, member.type])
    ).toEqual([
      ['react', 'string'],
      ['react-native', 'string | number'],
    ]);
    const obligations = new Map(
      avatarPlanning.obligations.map((item) => [item.id, item])
    );
    expect(obligations.size).toBe(avatarPlanning.obligations.length);
    expect([...obligations.keys()]).toEqual([
      'avatar-default-geometry',
      'avatar-image-presentation',
      'avatar-fallback-overflow',
      'avatar-accessibility-identity',
      'avatar-native-image-source',
      'avatar-independent-release-proof',
    ]);
    expect(obligations.get('avatar-default-geometry')?.consequence).toContain(
      'sm 24, md 32, lg 40'
    );
    expect(obligations.get('avatar-fallback-overflow')?.consequence).toContain(
      'ellipsis'
    );
    expect(
      obligations.get('avatar-accessibility-identity')?.consequence
    ).toContain('empty alt');
    expect(
      obligations.get('avatar-independent-release-proof')?.consequence
    ).toContain('Native requires device/OS');
    for (const obligation of obligations.values()) {
      expect(avatarPlanning.supportedCapabilities).toContain(
        obligation.capability
      );
      expect(obligation.consequence.length).toBeGreaterThan(40);
      expect(obligation.platformScope.length).toBeGreaterThan(0);
    }
  });
});
