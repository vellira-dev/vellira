import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  auditLegacyComponentDocs,
  inspectComponentDocAuthority,
  type DocsAdoptionState,
} from './legacy-adoption';
import {
  authoredRegionEndMarker,
  authoredRegionStartMarker,
} from './authored-region';
import { generatedComponentDocsHeader } from './render';

describe('read-only component docs adoption audit', () => {
  it.each([
    ['missing', undefined],
    ['legacy', '# Manual guide\n\nNever discard this guidance.\n'],
    [
      'managed',
      [
        generatedComponentDocsHeader,
        authoredRegionStartMarker,
        'Keep this content.',
        authoredRegionEndMarker,
      ].join('\n'),
    ],
    [
      'untrusted-markers',
      [
        '# Manual guide',
        authoredRegionStartMarker,
        'Unowned content.',
        authoredRegionEndMarker,
      ].join('\n'),
    ],
    ['invalid-markers', generatedComponentDocsHeader],
  ] as readonly (readonly [DocsAdoptionState, string | undefined])[])(
    'classifies %s files without changing content',
    (expected, content) => {
      const result = inspectComponentDocAuthority({
        content,
        filePath: 'react/fixture.md',
      });
      expect(result.state).toBe(expected);
      if (content !== undefined) {
        expect(result.bytes).toBe(Buffer.byteLength(content, 'utf8'));
        expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  );

  it('reports canonical component and platform inventory read-only', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-docs-adoption-audit-')
    );
    const reactDoc = path.join(root, 'apps/docs/src/react/button.md');
    const original = '# Button\n\nAn authored guide.\n';

    try {
      fs.mkdirSync(path.dirname(reactDoc), { recursive: true });
      fs.writeFileSync(reactDoc, original);

      const rows = auditLegacyComponentDocs({
        root,
        componentName: 'Button',
      });
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.platform === 'react')).toMatchObject({
        component: 'Button',
        state: 'legacy',
        hasDocsContract: false,
      });
      expect(
        rows.find((row) => row.platform === 'react-native')?.state
      ).toBe('missing');
      expect(fs.readFileSync(reactDoc, 'utf8')).toBe(original);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses unknown components rather than producing empty success', () => {
    expect(() =>
      auditLegacyComponentDocs({
        root: '/not-a-repository',
        componentName: 'NotAnApprovedComponent',
      })
    ).toThrow('Unknown canonical component');
  });
});
