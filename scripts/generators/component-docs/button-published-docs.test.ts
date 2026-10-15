import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buttonDocs } from '../../../apps/docs/src/component-docs/Button.docs';

import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const root = process.cwd();

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/button.md',
    packageName: '@vellira-ui/react',
    apiMarker: 'web.ButtonProps.Button',
    preservedExamples: [
      'story="button.matrix"',
      'story="button.icons"',
      '## Premium Action Patterns',
      '### Loading Without Layout Shift',
      '### Real Example: Project Header Actions',
      '## Web Links And Composition',
      'export function ProjectHeaderActions',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/button.md',
    packageName: '@vellira-ui/react-native',
    apiMarker: 'native.ButtonProps.Button',
    preservedExamples: [
      '## Basic Usage',
      '## Appearance And Color',
      '## Loading',
      '## Icons',
      '## Icon-Only Actions',
      '## Badge And Shortcut',
      '## Full Width And Styling',
      '## Destructive Confirmation',
      'onPress={handleSave}',
    ],
  },
] as const;

describe('published Button docs safe adoption', () => {
  it.each(pages)(
    'preserves the %s managed docs authority and entire editorial guide structure',
    ({ platform, relativePath, packageName, apiMarker, preservedExamples }) => {
      const filePath = path.join(root, relativePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const authority = inspectComponentDocAuthority({
        content,
        filePath: relativePath,
      });
      expect(authority.state).toBe('managed');
      expect(authority.errors).toEqual([]);

      const authored = readAuthoredRegion({ content, filePath });
      expect(authored.valid).toBe(true);
      expect(authored.found).toBe(true);
      if (!authored.valid || !authored.found) {
        throw new Error('Expected protected authored Button documentation');
      }

      const contract = buttonDocs.platforms[platform];
      expect(content).toContain(`title: '${contract.title}'`);
      expect(content).toContain(`description: '${contract.description}'`);
      expect(content).toContain(
        `import { Button } from '${packageName}';`
      );
      expect(content).toContain(`<!-- api-docgen:start ${apiMarker} -->`);
      expect(content).toContain(`<!-- api-docgen:end ${apiMarker} -->`);

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(new Set(headings).size).toBe(headings.length);
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');
      expect(authored.content).toContain('## Practical Usage Guidance');
      expect(authored.content).toContain('## Additional Accessibility Details');
      expect(authored.content).toContain('## Further Reading');

      for (const example of preservedExamples) {
        expect(authored.content).toContain(example);
      }
      // No placeholders may replace historical Button guidance.
      expect(authored.content).not.toContain(
        'Add editorial guidance here.'
      );
    }
  );
});
