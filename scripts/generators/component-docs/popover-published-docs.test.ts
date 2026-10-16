import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { popoverDocs } from '../../../apps/docs/src/component-docs/Popover.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parts = [
  'Anchor',
  'Trigger',
  'Content',
  'Arrow',
  'Close',
  'Title',
  'Description',
] as const;

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/popover.md',
    sourceBlob: '4139dad52a394a719cef610a8c04abd006040b21',
    packageName: '@vellira-ui/react',
    canonicalAuthorSha256:
      '6a7c2cb4b22133e07a4ea8bd95f6db708884aa0d9c75a9f1c073c27862ac53db',
    authorEvidence: [
      'story="popover.basic"',
      '## Practical Usage Guidance',
      '## Compound API',
      '## Open Change Details',
      '## Separate Anchor',
      '## Focus Management',
      '## Rendering Without A Portal',
      '## Additional Accessibility Details',
      '## Further Reading',
      'Popover.Anchor',
      'Popover.Arrow',
      'Popover.Title',
      'Popover.Description',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/popover.md',
    sourceBlob: 'fa8f0f304a51d0f48c41e5068ec95dd014258b2e',
    packageName: '@vellira-ui/react-native',
    canonicalAuthorSha256:
      '4863c8664cf7bd430b2959f2b738007bded4803f17548b816dae02b6acaaad5d',
    authorEvidence: [
      '## Open in Storybook',
      '## Practical Usage Guidance',
      '## Basic Usage',
      '## Controlled State',
      '## Uncontrolled State',
      '## Compound API',
      '## Positioning',
      '## Outside Press',
      '## Additional Accessibility Details',
      '## Further Reading',
      'Popover.Anchor',
      'Popover.Close',
      'VoiceOver',
      'TalkBack',
    ],
  },
] as const;

describe('published Popover docs safe legacy adoption', () => {
  it.each(pages)(
    'preserves complete $platform authored body and public compound API',
    (page) => {
      const content = fs.readFileSync(
        path.join(process.cwd(), page.relativePath),
        'utf8'
      );
      const inspection = inspectComponentDocAuthority({
        content,
        filePath: page.relativePath,
      });
      expect(inspection.state).toBe('managed');
      expect(inspection.errors).toEqual([]);
      const region = readAuthoredRegion({
        content,
        filePath: page.relativePath,
      });
      expect(region.valid).toBe(true);
      if (!region.valid || !region.found) {
        throw new Error('Missing trusted Popover authored region');
      }

      const contract = popoverDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { Popover } from '${page.packageName}';`
      );

      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      const api = fs.readFileSync(
        path.join(process.cwd(), `packages/${page.platform}/API.md`),
        'utf8'
      );
      const prefix = page.platform === 'react' ? 'web' : 'native';
      const apiNames = [
        'PopoverProps',
        ...parts.map((part) => `Popover${part}Props`),
      ];
      for (const name of apiNames) {
        const marker = `${prefix}.${name}.${name}`;
        const start = `<!-- api-docgen:start ${marker} -->`;
        const end = `<!-- api-docgen:end ${marker} -->`;
        expect(api.split(start)).toHaveLength(2);
        expect(api.split(end)).toHaveLength(2);
        expect(generated.split(start)).toHaveLength(2);
        expect(generated.split(end)).toHaveLength(2);
      }
      expect([
        ...generated.matchAll(
          /<!-- api-docgen:start (?:web|native)\.Popover\w*Props\./g
        ),
      ]).toHaveLength(apiNames.length);

      for (const original of page.authorEvidence) {
        expect(region.content).toContain(original);
      }

      // The only permitted body changes are these reversible aliases for
      // generator-owned headings. Recovered text must match the entire
      // Prettier-canonical original authored body, not selected excerpts.
      const recovered = region.content
        .trim()
        .replace('## Additional Accessibility Details', '## Accessibility')
        .replace('## Practical Usage Guidance', '## When To Use')
        .replace('## Further Reading', '## See Also');
      expect(sha256(recovered)).toBe(page.canonicalAuthorSha256);

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');
      expect(headings.length).toBe(new Set(headings).size);

      if (page.platform === 'react') {
        expect(generated).toContain('returnFocus');
        expect(generated).not.toContain('native.PopoverProps.PopoverProps');
      } else {
        expect(generated).toContain('closeOnOutsidePress');
        expect(generated).not.toContain('returnFocus');
        expect(generated).not.toContain('web.PopoverProps.PopoverProps');
      }
    }
  );
});
