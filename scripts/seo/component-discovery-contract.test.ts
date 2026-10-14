import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  auditComponentDiscoveryCatalog,
  auditComponentDiscoverySources,
} from './component-discovery-audit';
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

const canonicalSource = [
  'export const probeMetadata = defineComponentMetadata({',
  "  name: 'Probe',",
  "  status: 'stable',",
  "  platforms: ['react', 'react-native'],",
  '});',
].join('\n');

const validPageSource = [
  'export default defineComponentPageMetadata({',
  '  discovery: {',
  "    status: 'complete',",
  "    summary: 'Choose Probe for explicit selection.',",
  "    description: 'Probe is a controlled form selection.',",
  "    whenToUse: ['Use for independently selected choices.'],",
  '    patterns: [',
  "      { id: 'controlled', title: 'Controlled', description: 'Application owns the selection.' },",
  '    ],',
  '    platformNotes: {',
  "      react: ['Use browser accessibility semantics.'],",
  "      'react-native': ['Use native accessibility semantics.'],",
  '    },',
  '    missingEvidence: [],',
  '  },',
  '});',
].join('\n');

describe('Discovery source authority and inventory', () => {
  it('accepts supported static canonical and page contracts', () => {
    expect(
      auditComponentDiscoverySources({
        componentName: 'Probe',
        canonicalSource,
        pageSource: validPageSource,
      }).findings
    ).toEqual([]);
  });

  it('checks the effective default export, not an unused valid decoy', () => {
    const pageSource =
      validPageSource.replace(
        'export default defineComponentPageMetadata({',
        'const decoy = defineComponentPageMetadata({'
      ) +
      "\nexport default defineComponentPageMetadata({ discovery: { status: 'complete' } });";
    const result = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource,
      pageSource,
    });

    expect(result.findings).toContain('discovery.summary must be non-empty');
  });

  it('checks the canonical named export instead of an unused decoy', () => {
    const fakeSource =
      canonicalSource.replace(
        'export const probeMetadata',
        'const decoyMetadata'
      ) +
      '\nexport const probeMetadata = defineComponentMetadata({' +
      " name: 'Probe', status: getStatus(), platforms: ['react'] });";
    const result = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource: fakeSource,
      pageSource: validPageSource,
    });

    expect(result.findings).toContain(
      'canonical lifecycle status is missing or invalid'
    );
  });

  it('rejects ambiguous exported metadata authorities', () => {
    const pageSource =
      validPageSource +
      '\nexport const extra = defineComponentPageMetadata({});';
    const result = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource,
      pageSource,
    });

    expect(result.findings).toContain(
      'website metadata needs one default-exported authority'
    );
  });

  it('rejects spreads that can override proven Discovery fields', () => {
    const sources = [
      validPageSource.replace('\n});', '\n  ...overrideMetadata,\n});'),
      validPageSource.replace(
        '    missingEvidence: [],',
        '    missingEvidence: [],\n    ...overrideDiscovery,'
      ),
      validPageSource.replace(
        "      react: ['Use browser accessibility semantics.'],",
        "      react: ['Use browser accessibility semantics.'],\n      ...overrideNotes,"
      ),
    ];
    for (const pageSource of sources) {
      const result = auditComponentDiscoverySources({
        componentName: 'Probe',
        canonicalSource,
        pageSource,
      });
      expect(
        result.findings.some((finding) =>
          finding.includes('contains unprovable spread')
        )
      ).toBe(true);
    }
  });

  it('rejects overwritten or computed Discovery properties', () => {
    const pageSource = validPageSource.replace(
      '    missingEvidence: [],',
      "    missingEvidence: [],\n    ['status']: 'needs-authored-intent',"
    );
    const result = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource,
      pageSource,
    });

    expect(result.findings).toContain(
      'discovery contains unprovable property name'
    );
  });

  it('rejects incomplete adopted metadata in the source-level gate', () => {
    const pageSource = [
      'export default defineComponentPageMetadata({',
      "  discovery: { status: 'complete' },",
      '});',
    ].join('\n');
    expect(
      auditComponentDiscoverySources({
        componentName: 'Probe',
        canonicalSource,
        pageSource,
      }).findings
    ).toContain('discovery.summary must be non-empty');
  });

  it('fails closed when canonical evidence is absent or unparseable', () => {
    const missing = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource: undefined,
      pageSource: validPageSource,
    });
    expect(missing.findings).toContain('canonical metadata file is missing');

    const invalid = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource: canonicalSource.replace(
        "['react', 'react-native']",
        'getPlatforms()'
      ),
      pageSource: validPageSource,
    });
    expect(invalid.findings).toContain(
      'canonical platforms are missing or invalid'
    );

    const unknownStatus = auditComponentDiscoverySources({
      componentName: 'Probe',
      canonicalSource: canonicalSource.replace("'stable'", 'getStatus()'),
      pageSource: validPageSource,
    });
    expect(unknownStatus.findings).toContain(
      'canonical lifecycle status is missing or invalid'
    );
  });

  it('does not exempt a legacy component with missing canonical authority', () => {
    const legacy = auditComponentDiscoverySources({
      componentName: 'Accordion',
      canonicalSource: undefined,
      pageSource: 'export default defineComponentPageMetadata({});',
    });
    expect(legacy.exempt).toBe(true);
    expect(legacy.findings).toContain('canonical metadata file is missing');
  });

  it('counts component directories even without website metadata.ts', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-discovery-catalog-')
    );
    try {
      const componentRoot = path.join(
        root,
        'apps/website/src/component-catalog/components/Probe'
      );
      const canonicalRoot = path.join(root, 'packages/metadata/src/components');
      fs.mkdirSync(componentRoot, { recursive: true });
      fs.mkdirSync(canonicalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(canonicalRoot, 'Probe.metadata.ts'),
        canonicalSource
      );

      const result = auditComponentDiscoveryCatalog(root);
      expect(result.checked).toBe(1);
      expect(result.findings).toContain(
        'Probe: website component metadata file is missing'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
