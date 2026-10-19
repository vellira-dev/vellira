import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { tabsDocs } from '../../../apps/docs/src/component-docs/Tabs.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/tabs.md',
    marker: 'web.TabsProps.TabsProps',
    packageName: '@vellira-ui/react',
    examples: [
      'story="tabs.controlled"',
      '## Navigation Mode',
      '## Keyboard',
      '## Mounting',
      '## Real Example: Account Settings',
      'Tabs.Indicator',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/tabs.md',
    marker: 'native.TabsProps.TabsProps',
    packageName: '@vellira-ui/react-native',
    examples: [
      '## Basic Usage',
      '## Mounting Policy',
      '## Trigger Content',
      '## Navigation Mode',
      '## Scrollable Lists',
      'Tabs.Badge',
    ],
  },
] as const;

describe('published Tabs safe migration', () => {
  it.each(pages)(
    'preserves $platform Tabs guidance in managed docs',
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

      const author = readAuthoredRegion({
        content,
        filePath: page.relativePath,
      });
      expect(author.valid).toBe(true);
      if (!author.valid || !author.found) {
        throw new Error('Tabs historical guide was not preserved');
      }

      const contract = tabsDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(`import { Tabs } from '${page.packageName}';`);
      expect(content).toContain(`<!-- api-docgen:start ${page.marker} -->`);
      expect(content).toContain(`<!-- api-docgen:end ${page.marker} -->`);
      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings.length).toBe(new Set(headings).size);
      for (const example of page.examples)
        expect(author.content).toContain(example);
      expect(author.content).toContain('## Additional Accessibility Details');
      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      if (page.platform === 'react') {
        expect(generated).toContain('aria-current');
        expect(generated).not.toContain('VoiceOver');
      } else {
        expect(generated).toContain('VoiceOver');
        expect(generated).not.toContain('aria-current');
      }
    }
  );
});
