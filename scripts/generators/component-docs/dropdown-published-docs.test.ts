import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dropdownDocs } from '../../../apps/docs/src/component-docs/Dropdown.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/dropdown.md',
    packageName: '@vellira-ui/react',
    apiMarkers: [
      'web.DropdownProps.DropdownProps',
      'web.DropdownSubProps.DropdownSubProps',
      'web.DropdownCheckboxItemProps.DropdownCheckboxItemProps',
      'web.DropdownRadioGroupProps.DropdownRadioGroupProps',
    ],
    originalExamples: [
      'story="dropdown.groups"',
      '## Contract',
      '## Trigger Guidance',
      '## Rich Items',
      '## Checkbox And Radio Items',
      '## Nested Dropdowns and Submenus',
      'Dropdown.SubTrigger',
      'Dropdown.ItemShortcut',
      'event.preventDefault()',
      '## Additional Accessibility Details',
      '## Further Reading',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/dropdown.md',
    packageName: '@vellira-ui/react-native',
    apiMarkers: [
      'native.DropdownProps.DropdownProps',
      'native.DropdownContentProps.DropdownContentProps',
      'native.DropdownItemProps.DropdownItemProps',
      'native.DropdownEmptyProps.DropdownEmptyProps',
    ],
    originalExamples: [
      '## Basic Usage',
      '## Controlled Open State',
      '## Custom Trigger',
      '## Presentation',
      '## Search And Command Mode',
      '## Loading',
      '## Selection Behavior',
      '## Styling And Color',
      'defaultSearchValue',
      '## Additional Accessibility Details',
      '## Further Reading',
    ],
  },
] as const;

describe('published Dropdown docs safe adoption', () => {
  it.each(pages)(
    'preserves $platform Dropdown guidance and correct API authority',
    (page) => {
      const content = fs.readFileSync(
        path.join(process.cwd(), page.relativePath),
        'utf8'
      );
      const inspected = inspectComponentDocAuthority({
        content,
        filePath: page.relativePath,
      });
      expect(inspected.state).toBe('managed');
      expect(inspected.errors).toEqual([]);

      const author = readAuthoredRegion({
        content,
        filePath: page.relativePath,
      });
      expect(author.valid).toBe(true);
      if (!author.valid || !author.found) {
        throw new Error('Dropdown authored guide must remain protected');
      }

      const contract = dropdownDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { Dropdown } from '${page.packageName}';`
      );

      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      for (const apiMarker of page.apiMarkers) {
        expect(generated).toContain(`<!-- api-docgen:start ${apiMarker} -->`);
        expect(generated).toContain(`<!-- api-docgen:end ${apiMarker} -->`);
      }
      for (const example of page.originalExamples) {
        expect(author.content).toContain(example);
      }
      expect(author.content).not.toContain(
        '<!-- Add manually authored content for this component here. -->'
      );

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings.length).toBe(new Set(headings).size);
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');

      if (page.platform === 'react') {
        expect(generated).toContain('aria-haspopup');
        expect(generated).toContain('web.DropdownSubTriggerProps');
        expect(generated).not.toContain('accessibilityHint');
      } else {
        expect(generated).toContain('accessibilityHint');
        expect(generated).not.toContain('native.DropdownSubProps');
        expect(generated).not.toContain('web.DropdownCheckboxItemProps');
        expect(generated).not.toContain('aria-haspopup');
      }
    }
  );
});
