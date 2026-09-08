import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalCssVariableNames } from '../../design-resources/authority';
import {
  checkSourceFile,
  checkStyleFile,
  runVelliraUiUsageCheck,
  type VelliraUiUsageAuthorities,
} from './checker';

const temporaryRoots: string[] = [];
const AUTHORITIES: VelliraUiUsageAuthorities = {
  canonicalIcons: new Set(['Close', 'Search']),
  canonicalCssVariables: new Set([
    '--surface-canvas',
    '--surface-panel',
    '--text-primary',
  ]),
};

afterEach(() => {
  while (temporaryRoots.length > 0) {
    fs.rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('Vellira UI usage audit', () => {
  it('passes canonical Vellira component usage and semantic layout markup', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `
        import { Button } from '@vellira-ui/react';

        export function Example() {
          return (
            <main>
              <section>
                <article>
                  <Button>Save</Button>
                </article>
              </section>
            </main>
          );
        }
      `,
      AUTHORITIES
    );

    expect(findings).toEqual([]);
  });

  it('reports authored button when canonical Button exists', () => {
    const [finding] = checkSourceFile(
      'apps/website/src/example.tsx',
      `export function Example() { return <button type="button">Save</button>; }`,
      AUTHORITIES
    );

    expect(finding).toMatchObject({
      ruleId: 'vellira-ui.existing-component-bypass',
      detected: 'button',
      canonicalAlternative: 'Button',
      severity: 'warning',
      blocking: false,
      nextAction: 'reuse-existing',
    });
  });

  it('maps checkbox and radio inputs to their canonical controls', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `
        export function Example() {
          return <><input type="checkbox" /><input type={'radio'} /></>;
        }
      `,
      AUTHORITIES
    );

    expect(findings.map((finding) => finding.canonicalAlternative)).toEqual([
      'Checkbox',
      'Radio',
    ]);
  });

  it('does not classify non-text infrastructure inputs as Input bypasses', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `
        export function Example() {
          return <><input type="hidden" /><input type="file" /><input type="range" /><input type="color" /></>;
        }
      `,
      AUTHORITIES
    );

    expect(findings).toEqual([]);
  });

  it('routes textarea through the missing-component workflow while Textarea is absent', () => {
    const [finding] = checkSourceFile(
      'apps/docs/src/example.tsx',
      `export function Example() { return <textarea />; }`,
      AUTHORITIES
    );

    expect(finding).toMatchObject({
      ruleId: 'vellira-ui.missing-component',
      detected: 'textarea',
      severity: 'warning',
      blocking: false,
      nextAction: 'request-missing-component',
    });
    expect(finding.canonicalAlternative).toBeUndefined();
  });

  it('keeps canonical component implementation internals outside consumer scope', () => {
    const findings = checkSourceFile(
      'packages/react/src/components/Button/Button.tsx',
      `export function Button() { return <button type="button" />; }`,
      AUTHORITIES
    );

    expect(findings).toEqual([]);
  });

  it('reports deterministic local and third-party component duplicates', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `
        import { Button } from './controls/Button';
        import { Dialog } from '@radix-ui/react-dialog';
        export function Example() { return <><Button /><Dialog /></>; }
      `,
      AUTHORITIES
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'vellira-ui.local-component-duplicate',
          canonicalAlternative: 'Button',
        }),
        expect.objectContaining({
          ruleId: 'vellira-ui.third-party-bypass',
          canonicalAlternative: 'Modal',
        }),
      ])
    );
  });

  it('passes canonical icon usage and reports local or inline icon bypasses', () => {
    const canonical = checkSourceFile(
      'apps/website/src/canonical.tsx',
      `import { Search } from '@vellira-ui/react/icons'; export const A = () => <Search />;`,
      AUTHORITIES
    );
    const local = checkSourceFile(
      'apps/website/src/local.tsx',
      `import SearchIcon from './icons/SearchIcon'; export const A = () => <SearchIcon />;`,
      AUTHORITIES
    );
    const inline = checkSourceFile(
      'apps/website/src/inline.tsx',
      `export const A = () => <svg viewBox="0 0 10 10" />;`,
      AUTHORITIES
    );

    expect(canonical).toEqual([]);
    expect(local).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.noncanonical-icon',
        canonicalAlternative: 'Search',
      }),
    ]);
    expect(inline).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.noncanonical-icon',
        detected: 'svg',
        nextAction: 'request-missing-resource',
      }),
    ]);
  });

  it('passes canonical CSS variables and reports raw or removed token resources', () => {
    const findings = checkStyleFile(
      'apps/website/src/example.module.css',
      `
        .canonical { color: var(--text-primary); background: var(--surface-panel); }
        .local { padding-inline: var(--site-gutter); }
        .removed { background: var(--surface-background); }
        .raw { border: 1px solid #ff00aa; color: rgb(1 2 3); }
      `,
      AUTHORITIES
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'vellira-ui.missing-token-resource',
          detected: '--surface-background',
        }),
        expect.objectContaining({
          ruleId: 'vellira-ui.noncanonical-token-value',
          detected: '#ff00aa',
        }),
        expect.objectContaining({
          ruleId: 'vellira-ui.noncanonical-token-value',
          detected: 'rgb(1 2 3)',
        }),
      ])
    );
    expect(
      findings.some((finding) => finding.detected === '--site-gutter')
    ).toBe(false);
  });

  it('reports hard-coded inline visual colors while allowing token strings', () => {
    const findings = checkSourceFile(
      'apps/website/src/example.tsx',
      `
        export function Example() {
          return <><div style={{ color: '#fff' }} /><div style={{ color: 'var(--text-primary)' }} /></>;
        }
      `,
      AUTHORITIES
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.noncanonical-token-value',
        detected: '#fff',
      }),
    ]);
  });

  it('reads canonical CSS variable names through the existing #760 authority', () => {
    expect(canonicalCssVariableNames(process.cwd())).toEqual(
      expect.objectContaining({})
    );
    expect(
      canonicalCssVariableNames(process.cwd())?.has('--surface-canvas')
    ).toBe(true);
  });

  it('applies only exact documented exceptions and records the evidence', () => {
    const root = makeRoot();
    write(
      root,
      'apps/website/src/example.tsx',
      `<button type="button">Infrastructure</button>`
    );

    const report = runVelliraUiUsageCheck(root, {
      authorities: AUTHORITIES,
      exceptions: [
        {
          ruleId: 'vellira-ui.existing-component-bypass',
          path: 'apps/website/src/example.tsx',
          line: 1,
          detected: 'button',
          category: 'framework-infrastructure',
          reason: 'Framework-owned hydration control boundary.',
          issue: '#850',
        },
      ],
    });

    expect(report.findings).toEqual([]);
    expect(report.exceptions).toEqual([
      expect.objectContaining({
        path: 'apps/website/src/example.tsx',
        line: 1,
        detected: 'button',
        category: 'framework-infrastructure',
        issue: '#850',
      }),
    ]);
    expect(report.summary.exceptionsApplied).toBe(1);
  });

  it('rejects broad wildcard exceptions instead of creating an allowlist escape hatch', () => {
    const root = makeRoot();
    write(
      root,
      'apps/website/src/example.tsx',
      `<button type="button">Save</button>`
    );

    expect(() =>
      runVelliraUiUsageCheck(root, {
        authorities: AUTHORITIES,
        exceptions: [
          {
            ruleId: 'vellira-ui.existing-component-bypass',
            path: 'apps/website/src/**',
            line: 1,
            detected: 'button',
            category: 'architectural-exception',
            reason:
              'This intentionally demonstrates a forbidden broad exception.',
            issue: '#850',
          },
        ],
      })
    ).toThrow(/exact and documented/);
  });

  it('scans app source deterministically and remains non-blocking in audit mode', () => {
    const root = makeRoot();

    write(
      root,
      'apps/website/src/z.tsx',
      `export function Z() { return <select />; }`
    );
    write(
      root,
      'apps/docs/src/a.tsx',
      `export function A() { return <button type="button" />; }`
    );
    write(
      root,
      'apps/website/src/theme.css',
      `.root { color: var(--text-primary); }`
    );
    write(
      root,
      'packages/react/src/ignored.tsx',
      `export function Ignored() { return <button type="button" />; }`
    );

    const report = runVelliraUiUsageCheck(root, {
      authorities: AUTHORITIES,
    });

    expect(report).toMatchObject({
      schemaVersion: '1',
      mode: 'audit',
      summary: {
        filesScanned: 3,
        findings: 2,
        blockingFindings: 0,
        exceptionsApplied: 0,
      },
    });
    expect(report.findings.map((finding) => finding.path)).toEqual([
      'apps/docs/src/a.tsx',
      'apps/website/src/z.tsx',
    ]);
  });
});

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-ui-usage-'));
  temporaryRoots.push(root);
  return root;
}

function write(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}
