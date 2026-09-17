import { describe, expect, it } from 'vitest';

import type {
  ComponentExpansionTarget,
  ComponentMetadata,
} from '@vellira-ui/metadata';

import type { VelliraUiUsageFinding } from '../checks/vellira-ui-usage/types';
import { parseComponentProductionInput } from './contracts';
import {
  missingComponentRequestFromUiFinding,
  parseMissingComponentRequest,
  resolveMissingComponentRequest,
  resolveMissingComponentUiFinding,
  runMissingComponentRequestCli,
  type MissingComponentAuthorities,
} from './missing-component-request';

const requirements = {
  tests: true,
  storybook: true,
  docs: true,
  accessibility: true,
} as const;

const button = {
  name: 'Button',
  layer: 'primitives',
  category: 'action',
  platforms: ['react', 'react-native'],
  profile: 'base',
  status: 'stable',
  capabilities: ['disabled'],
  requirements,
} as const satisfies ComponentMetadata;

const modal = {
  name: 'Modal',
  layer: 'components',
  category: 'overlay',
  platforms: ['react', 'react-native'],
  profile: 'overlay',
  status: 'stable',
  capabilities: ['controlled', 'uncontrolled', 'portal'],
  requirements,
} as const satisfies ComponentMetadata;

const textareaTarget = {
  name: 'Textarea',
  layer: 'primitives',
  category: 'form',
  platforms: ['react', 'react-native'],
  profile: 'form-control',
  componentTokens: 'standard',
  role: 'form-control',
  intent: {
    schemaVersion: '1',
    job: 'Enter and edit multiline text.',
    requiredCapabilities: ['multiline', 'accessible-name'],
  },
} as const satisfies ComponentExpansionTarget;

const dialogTarget = {
  name: 'DialogSurface',
  layer: 'components',
  category: 'overlay',
  platforms: ['react', 'react-native'],
  profile: 'overlay',
  componentTokens: 'standard',
  role: 'catalog',
  representedBy: ['Modal'],
  intent: {
    schemaVersion: '1',
    job: 'Present a blocking dialog surface.',
    requiredCapabilities: ['portal'],
  },
} as const satisfies ComponentExpansionTarget;

const avatarTarget = {
  name: 'Avatar',
  layer: 'primitives',
  category: 'data-display',
  platforms: ['react', 'react-native'],
  profile: 'base',
  componentTokens: 'standard',
  role: 'foundational',
  intent: {
    schemaVersion: '1',
    job: 'Represent identity with an image and deterministic fallback.',
    requiredCapabilities: [
      'image-source',
      'fallback',
      'size-variants',
      'accessible-name',
    ],
  },
} as const satisfies ComponentExpansionTarget;

const authorities: MissingComponentAuthorities = {
  components: [button, modal],
  targets: [textareaTarget, dialogTarget],
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '1',
    requestedComponent: 'Textarea',
    requestedIntent: 'multiline text entry',
    consumer: 'apps/website/src/example.tsx',
    platforms: ['react'],
    reusable: true,
    ...overrides,
  };
}

function missingTextareaFinding(
  path = 'apps/docs/src/example.tsx'
): VelliraUiUsageFinding {
  return {
    ruleId: 'vellira-ui.missing-component',
    path,
    line: 1,
    column: 1,
    detected: 'textarea',
    severity: 'error',
    blocking: true,
    nextAction: 'request-missing-component',
    message: 'Route the missing reusable control through component production.',
  };
}

describe('missing-component request workflow', () => {
  it('reuses an existing canonical component when the request is satisfied', () => {
    const result = resolveMissingComponentRequest(
      request({
        requestedComponent: 'Button',
        requestedIntent: 'primary action',
        platforms: ['react-native', 'react'],
        requiredCapabilities: ['disabled'],
      }),
      authorities
    );

    expect(result).toMatchObject({
      kind: 'reuse-existing',
      blocked: false,
      nextAction: 'reuse-existing',
      canonicalComponent: 'Button',
      existingCandidates: ['Button'],
      missingPlatforms: [],
      missingCapabilities: [],
    });
    expect(result.request.platforms).toEqual(['react', 'react-native']);
  });

  it('routes a capability or platform gap to the existing component', () => {
    const result = resolveMissingComponentRequest(
      request({
        requestedComponent: 'Button',
        requestedIntent: 'loading action',
        requiredCapabilities: ['loading'],
      }),
      authorities
    );

    expect(result).toMatchObject({
      kind: 'enhance-existing',
      blocked: true,
      nextAction: 'link-or-create-component-enhancement-issue',
      canonicalComponent: 'Button',
      existingCandidates: ['Button'],
      missingCapabilities: ['loading'],
      issueRequest: {
        kind: 'enhancement',
        componentName: 'Button',
        title: 'feat(components): extend Button',
      },
    });
  });

  it('does not reuse a generic component scaffold that misses approved target intent', () => {
    const genericAvatar: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react', 'react-native'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        ...requirements,
        componentTokens: 'standard',
      },
    };

    const result = resolveMissingComponentRequest(
      request({
        requestedComponent: 'Avatar',
        requestedIntent: 'identity image',
        platforms: ['react', 'react-native'],
      }),
      {
        components: [genericAvatar],
        targets: [avatarTarget],
      }
    );

    expect(result).toMatchObject({
      kind: 'enhance-existing',
      blocked: true,
      canonicalComponent: 'Avatar',
      missingCapabilities: [
        'accessible-name',
        'fallback',
        'image-source',
        'size-variants',
      ],
    });
  });

  it('reuses a component only when approved target intent is covered', () => {
    const completeAvatar: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react', 'react-native'],
      profile: 'base',
      status: 'experimental',
      capabilities: avatarTarget.intent.requiredCapabilities,
      requirements: {
        ...requirements,
        componentTokens: 'standard',
      },
    };

    expect(
      resolveMissingComponentRequest(
        request({
          requestedComponent: 'Avatar',
          requestedIntent: 'identity image',
          platforms: ['react', 'react-native'],
        }),
        {
          components: [completeAvatar],
          targets: [avatarTarget],
        }
      )
    ).toMatchObject({
      kind: 'reuse-existing',
      blocked: false,
      canonicalComponent: 'Avatar',
      missingCapabilities: [],
    });
  });

  it('emits a deterministic new-component request and production seed', () => {
    const result = resolveMissingComponentRequest(request(), authorities);

    expect(result).toMatchObject({
      kind: 'missing-component',
      blocked: true,
      nextAction: 'link-or-create-component-token-reservation-issue',
      existingCandidates: [],
      issueRequest: {
        kind: 'new-component',
        componentName: 'Textarea',
        title: 'feat(components): add Textarea',
      },
      productionSeed: {
        schemaVersion: '1',
        componentName: 'Textarea',
        platform: 'both',
        layer: 'primitives',
        category: 'form',
        profile: 'form-control',
      },
    });

    expect(parseComponentProductionInput(result.productionSeed)).toMatchObject({
      componentName: 'Textarea',
      platform: 'both',
      layer: 'primitives',
      category: 'form',
      profile: 'form-control',
    });
  });

  it('keeps duplicate request identity stable across consumer evidence', () => {
    const first = resolveMissingComponentRequest(
      request({
        requestedComponent: 'Toast',
        requestedIntent: 'transient feedback',
      }),
      authorities
    );
    const second = resolveMissingComponentRequest(
      request({
        requestedComponent: 'toast',
        requestedIntent: 'temporary status message',
        consumer: 'apps/docs/src/example.tsx',
        platforms: ['react-native'],
      }),
      authorities
    );

    expect(first.kind).toBe('missing-component');
    expect(second.kind).toBe('missing-component');
    expect(first.requestId).toBe(second.requestId);
    expect(first.productionSeed).toBeUndefined();
  });

  it('uses explicit representedBy metadata instead of creating a duplicate', () => {
    const result = resolveMissingComponentRequest(
      request({
        requestedComponent: 'DialogSurface',
        requestedIntent: 'blocking dialog',
        requiredCapabilities: ['portal'],
      }),
      authorities
    );

    expect(result).toMatchObject({
      kind: 'reuse-existing',
      blocked: false,
      canonicalComponent: 'Modal',
      existingCandidates: ['Modal'],
    });
  });

  it('does not create a design-system component for page-specific layout', () => {
    const result = resolveMissingComponentRequest(
      {
        schemaVersion: '1',
        requestedIntent: 'page-specific two-column layout',
        consumer: 'apps/website/src/example.tsx',
        platforms: ['react'],
        reusable: false,
      },
      authorities
    );

    expect(result).toMatchObject({
      kind: 'no-component-required',
      blocked: false,
      nextAction: 'none',
      existingCandidates: [],
    });
  });

  it('routes the current #850 textarea finding without parsing prose', () => {
    const requestFromFinding = missingComponentRequestFromUiFinding(
      missingTextareaFinding()
    );

    expect(requestFromFinding).toEqual({
      schemaVersion: '1',
      requestedComponent: 'Textarea',
      requestedIntent: 'multiline text entry',
      consumer: 'apps/docs/src/example.tsx',
      platforms: ['react'],
      reusable: true,
      requiredCapabilities: [],
    });

    expect(
      resolveMissingComponentUiFinding(
        missingTextareaFinding('apps/native-playground/src/example.tsx'),
        authorities
      )
    ).toMatchObject({
      kind: 'missing-component',
      request: {
        platforms: ['react-native'],
      },
    });
  });

  it('fails closed for unsupported findings and malformed requests', () => {
    expect(() =>
      missingComponentRequestFromUiFinding({
        ...missingTextareaFinding(),
        ruleId: 'vellira-ui.noncanonical-icon',
        detected: 'svg',
        nextAction: 'request-missing-resource',
      })
    ).toThrow(/not a missing-component request/);

    expect(() =>
      missingComponentRequestFromUiFinding({
        ...missingTextareaFinding(),
        detected: 'custom-control',
      })
    ).toThrow(/No deterministic missing-component mapping/);

    expect(() =>
      parseMissingComponentRequest({
        ...request(),
        platforms: ['react', 'react'],
      })
    ).toThrow(/must not contain duplicates/);

    expect(() =>
      parseMissingComponentRequest({
        ...request(),
        surprise: true,
      })
    ).toThrow(/Unknown missing-component request field/);
  });

  it('exposes blocked and non-blocked resolution through the JSON CLI', async () => {
    const output: string[] = [];
    const blocked = await runMissingComponentRequestCli(
      ['--spec', 'request.json'],
      {
        readFile: () => JSON.stringify(request()),
        resolve: (value) => resolveMissingComponentRequest(value, authorities),
        write: (message) => output.push(message),
      }
    );

    expect(blocked).toBe(1);
    expect(JSON.parse(output[0])).toMatchObject({
      kind: 'missing-component',
      blocked: true,
    });

    output.length = 0;
    const reused = await runMissingComponentRequestCli(
      ['--spec', 'request.json'],
      {
        readFile: () =>
          JSON.stringify(
            request({
              requestedComponent: 'Button',
              requestedIntent: 'primary action',
            })
          ),
        resolve: (value) => resolveMissingComponentRequest(value, authorities),
        write: (message) => output.push(message),
      }
    );

    expect(reused).toBe(0);
    expect(JSON.parse(output[0])).toMatchObject({
      kind: 'reuse-existing',
      blocked: false,
      canonicalComponent: 'Button',
    });
  });
});
