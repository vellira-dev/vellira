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
        '---',
        'title: "Managed Component"',
        'description: "Generated documentation."',
        '---',
        '',
        generatedComponentDocsHeader,
        '',
        '# FixtureSwitch',
        '',
        '## Import',
        '',
        authoredRegionStartMarker,
        'Keep this content.',
        authoredRegionEndMarker,
        '',
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

  it('rejects header and authored markers inside a handwritten fenced example', () => {
    for (const fence of ['~~~', String.fromCharCode(96).repeat(3)]) {
      const content = [
        '---',
        'title: "Handwritten documentation"',
        'description: "Existing editorial examples."',
        '---',
        '',
        '# FixtureSwitch',
        '',
        'This introduction must not be replaced.',
        '',
        fence + 'markdown',
        generatedComponentDocsHeader,
        authoredRegionStartMarker,
        'Only an example, not the author region.',
        authoredRegionEndMarker,
        fence,
        '',
        'Preserve this conclusion too.',
        '',
      ].join('\n');
      const result = inspectComponentDocAuthority({
        content,
        filePath: 'react/fixture-switch.md',
      });

      expect(result.state).toBe('untrusted-markers');
      expect(result.errors.join(' ')).toContain(
        'generated docs ownership header must be unique'
      );
      expect(result.bytes).toBe(Buffer.byteLength(content, 'utf8'));
    }
  });

  it('rejects authored markers inside a fenced example after a real header', () => {
    const content = [
      '---',
      'title: "FixtureSwitch"',
      'description: "Illustrated usage."',
      '---',
      '',
      generatedComponentDocsHeader,
      '',
      '# FixtureSwitch',
      '',
      '## Import',
      '',
      '~~~md',
      authoredRegionStartMarker,
      'These are only quoted markers.',
      authoredRegionEndMarker,
      '~~~',
      '',
    ].join('\n');
    const result = inspectComponentDocAuthority({
      content,
      filePath: 'react/fixture-switch.md',
    });

    expect(result.state).toBe('untrusted-markers');
    expect(result.errors.join(' ')).toContain('outside code fences');
  });

  it('rejects a second generated header or author text after the end marker', () => {
    const managed = [
      '---',
      'title: "FixtureSwitch"',
      'description: "Generated docs."',
      '---',
      '',
      generatedComponentDocsHeader,
      '',
      '# FixtureSwitch',
      '',
      '## Import',
      '',
      authoredRegionStartMarker,
      'Preserve this section.',
      authoredRegionEndMarker,
      '',
    ].join('\n');
    const appended = managed + '\nA manually added paragraph.\n';
    const duplicated = managed.replace(
      '# FixtureSwitch',
      '# FixtureSwitch\n' + generatedComponentDocsHeader
    );

    expect(
      inspectComponentDocAuthority({
        content: appended,
        filePath: 'react/fixture-switch.md',
      }).errors.join(' ')
    ).toContain('end marker must terminate the document');
    expect(
      inspectComponentDocAuthority({
        content: duplicated,
        filePath: 'react/fixture-switch.md',
      }).errors.join(' ')
    ).toContain('ownership header must be unique');
  });

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
        // A registered contract does not make a handwritten page managed.
        state: 'legacy',
        hasDocsContract: true,
      });
      expect(rows.find((row) => row.platform === 'react-native')?.state).toBe(
        'missing'
      );
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
