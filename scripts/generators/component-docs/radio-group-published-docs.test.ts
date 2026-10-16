import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { radioGroupDocs } from '../../../apps/docs/src/component-docs/RadioGroup.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parts = ['Item'] as const;

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/radio-group.md',
    sourceBlob: '6926d44594be6711c436b402c7da125e9ed8f0ec',
    packageName: '@vellira-ui/react',
    canonicalAuthorSha256:
      'fbc13d226a198c952355164c81dfb211450e9cca190f3137d7cd9faf5046ce22',
    authorEvidence: [
      'story="radioGroup.states"',
      '## Practical Usage Guidance',
      '## API Shape',
      '## Props',
      '## Layout Guidance',
      '## Controlled State',
      '## Real Example: Billing Interval',
      '## Additional Accessibility Details',
      '## Further Reading',
      "value='monthly'",
      "value='yearly'",
      'onValueChange={setInterval}',
      'BillingIntervalForm',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/radio-group.md',
    sourceBlob: 'd97920db7b6589ea8bc185f1e45e59cede1a87bd',
    packageName: '@vellira-ui/react-native',
    canonicalAuthorSha256:
      'be25f08d0403fcc2fc9e2cb79b17b72fd774039489f33812142cfac3b75267c0',
    authorEvidence: [
      '## Basic Usage',
      '## Controlled Usage',
      '## Orientation',
      '## Group State',
      '## Custom Indicator',
      '## Standalone Radio',
      '## Additional Accessibility Details',
      '## Further Reading',
      'VoiceOver',
      'TalkBack',
      'onCheckedChange={setSelected}',
      'CustomSelectedIcon',
    ],
  },
] as const;

describe('published RadioGroup docs safe legacy adoption', () => {
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
        throw new Error('Missing trusted RadioGroup authored region');
      }

      const contract = radioGroupDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { RadioGroup } from '${page.packageName}';`
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
        'RadioGroupProps',
        ...parts.map((part) => `RadioGroup${part}Props`),
      ];
      const publicIndex = fs.readFileSync(
        path.join(process.cwd(), `packages/${page.platform}/src/index.ts`),
        'utf8'
      );
      const publicPropNames = [
        ...new Set(
          publicIndex.match(/\bRadioGroup(?:[A-Za-z]+)?Props\b/g) ?? []
        ),
      ].sort();
      expect(publicPropNames).toEqual([...apiNames].sort());
      expect(content).toContain('## API');
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
          /<!-- api-docgen:start (?:web|native)\.RadioGroup\w*Props\./g
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

      expect(region.content).toContain('## Additional Accessibility Details');
      const radioItemAlias = fs.readFileSync(
        path.join(
          process.cwd(),
          `packages/${page.platform}/src/components/RadioGroup/Item/types.ts`
        ),
        'utf8'
      );
      expect(radioItemAlias).toContain(
        'export type RadioGroupItemProps = RadioProps;'
      );
      const compoundSource = fs.readFileSync(
        path.join(
          process.cwd(),
          `packages/${page.platform}/src/components/RadioGroup/RadioGroup.tsx`
        ),
        'utf8'
      );
      expect(compoundSource).toContain('Item: RadioGroupItem');
      if (page.platform === 'react') {
        expect(generated).toContain('wrapperClassName');
        expect(generated).not.toContain(
          'native.RadioGroupProps.RadioGroupProps'
        );
      } else {
        expect(generated).toContain('containerStyle');
        expect(generated).not.toContain('web.RadioGroupProps.RadioGroupProps');
      }
    }
  );
});
