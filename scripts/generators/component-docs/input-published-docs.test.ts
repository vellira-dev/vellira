import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { inputDocs } from '../../../apps/docs/src/component-docs/Input.docs';

import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const root = process.cwd();
const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/input.md',
    packageName: '@vellira-ui/react',
    apiMarker: 'web.InputProps.Input',
    originalSections: [
      'story="input.validation"',
      '## Field Composition',
      '## Field Anatomy',
      '## Recommended Patterns',
      '### Input + FormField',
      '### Input + Tooltip',
      '### Input + Validation',
      '## Real Example: Profile Settings',
      '## Clearable Inputs',
      '## Icons, Addons, And Affixes',
      '## Masks And Formatting',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/input.md',
    packageName: '@vellira-ui/react-native',
    apiMarker: 'native.InputProps.Input',
    originalSections: [
      '## Basic Usage',
      '## Controlled And Uncontrolled',
      '## Field Semantics',
      '## Clearable Input',
      '## Icons',
      '## Password Reveal',
      '## Masks And Formatting',
      '## Counter',
      '## Native Input Props',
      '## Styling',
      'onClear={() => setQuery(\'\')}',
    ],
  },
] as const;

describe('published Input docs safe legacy adoption', () => {
  it.each(pages)(
    'keeps the $platform published docs generator-owned with original examples',
    ({ platform, relativePath, packageName, apiMarker, originalSections }) => {
      const filePath = path.join(root, relativePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const authority = inspectComponentDocAuthority({
        content,
        filePath: relativePath,
      });
      expect(authority.state).toBe('managed');
      expect(authority.errors).toEqual([]);

      const region = readAuthoredRegion({ content, filePath });
      expect(region.valid).toBe(true);
      if (!region.valid) {
        throw new Error('Invalid protected Input authored-region markers');
      }
      expect(region.found).toBe(true);
      if (!region.found) {
        throw new Error('Input historical guide was not preserved');
      }

      const contract = inputDocs.platforms[platform];
      expect(content).toContain(`title: '${contract.title}'`);
      expect(content).toContain(`description: '${contract.description}'`);
      expect(content).toContain(`import { Input } from '${packageName}';`);
      expect(content).toContain(`<!-- api-docgen:start ${apiMarker} -->`);
      expect(content).toContain(`<!-- api-docgen:end ${apiMarker} -->`);

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings.length).toBe(new Set(headings).size);
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');
      expect(region.content).toContain('## Additional Accessibility Details');
      expect(region.content).toContain('## Further Reading');
      if (platform === 'react') {
        expect(region.content).toContain('## Practical Usage Guidance');
      }

      for (const section of originalSections) {
        expect(region.content).toContain(section);
      }
      expect(region.content).not.toContain(
        '<!-- Add manually authored content for this component here. -->'
      );
    }
  );
});
