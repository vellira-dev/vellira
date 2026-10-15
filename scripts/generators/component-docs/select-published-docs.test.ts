import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { selectDocs } from '../../../apps/docs/src/component-docs/Select.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const pages = [
  {
    platform: 'react',
    path: 'apps/docs/src/react/select.md',
    packageName: '@vellira-ui/react',
    marker: 'web.SelectProps.SelectProps',
    requiredExamples: [
      'story="select.selection"',
      '## Option Model',
      '## Compound API',
      '## Multiple And Group Selection',
      '## Real Example: Member Role',
      'Select.ItemBadge',
    ],
  },
  {
    platform: 'react-native',
    path: 'apps/docs/src/react-native/select.md',
    packageName: '@vellira-ui/react-native',
    marker: 'native.SelectProps.SelectProps',
    requiredExamples: [
      '## Basic Usage',
      '## Presentation',
      '## Async Search',
      '## Virtualization',
      '## Options Array',
      "accessibilityHint='Opens a list of supported countries'",
    ],
  },
] as const;

describe('Select published docs adoption', () => {
  it.each(pages)(
    'keeps $platform Select docs managed and preserves examples',
    (page) => {
      const content = fs.readFileSync(
        path.join(process.cwd(), page.path),
        'utf8'
      );
      const authority = inspectComponentDocAuthority({
        content,
        filePath: page.path,
      });
      expect(authority.state).toBe('managed');
      expect(authority.errors).toEqual([]);

      const authored = readAuthoredRegion({ content, filePath: page.path });
      expect(authored.valid).toBe(true);
      if (!authored.valid || !authored.found) {
        throw new Error('Select authored text region is missing or invalid');
      }

      const contract = selectDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { Select } from '${page.packageName}';`
      );
      expect(content).toContain(`<!-- api-docgen:start ${page.marker} -->`);
      expect(content).toContain(`<!-- api-docgen:end ${page.marker} -->`);

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings.length).toBe(new Set(headings).size);
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');

      for (const example of page.requiredExamples) {
        expect(authored.content).toContain(example);
      }

      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      if (page.platform === 'react') {
        expect(generated).toContain('aria-describedby');
        expect(generated).not.toContain('accessibilityHint');
      } else {
        expect(generated).toContain('accessibilityHint');
        expect(generated).not.toContain('aria-describedby');
      }
    }
  );
});
