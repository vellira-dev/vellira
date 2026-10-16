import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { tooltipDocs } from '../../../apps/docs/src/component-docs/Tooltip.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parts = ['Trigger', 'Content'] as const;

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/tooltip.md',
    sourceBlob: '13343e878a0460a1cc39ce8bb830499d2a36bfa2',
    packageName: '@vellira-ui/react',
    canonicalAuthorSha256:
      '__TOOLTIP_REACT_AUTHOR_SHA256__',
    authorEvidence: [
      'story="tooltip.triggers"',
      '## Practical Usage Guidance',
      '## Web Usage',
      '## Native Usage',
      '## Controlled State',
      '## Delays And Placement',
      '## Force Mounted Content',
      '## Real Example: Dense Toolbar',
      '## Additional Accessibility Details',
      '## Further Reading',
      'Tooltip.Trigger asChild',
      'Tooltip.Content withArrow',
      'Portal',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/tooltip.md',
    sourceBlob: '8ae424d6631bbbb01f39d7785b6c24b4c3d94a97',
    packageName: '@vellira-ui/react-native',
    canonicalAuthorSha256:
      '__TOOLTIP_NATIVE_AUTHOR_SHA256__',
    authorEvidence: [
      '## Basic Usage',
      '## Controlled State',
      '## Placement And Offset',
      '## Delay',
      '## Outside Dismissal',
      '## Disabled Tooltip',
      '## Force Mount',
      '## Styling',
      '## Additional Accessibility Details',
      '## Further Reading',
      'Tooltip.Content forceMount',
      'accessibilityLabel',
      'withArrow',
    ],
  },
] as const;

describe('published Tooltip docs safe legacy adoption', () => {
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
        throw new Error('Missing trusted Tooltip authored region');
      }

      const contract = tooltipDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { Tooltip } from '${page.packageName}';`
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
        'TooltipProps',
        ...parts.map((part) => `Tooltip${part}Props`),
      ];
      const publicIndex = fs.readFileSync(
        path.join(process.cwd(), `packages/${page.platform}/src/index.ts`),
        'utf8'
      );
      const publicPropNames = [
        ...new Set(publicIndex.match(/\bTooltip(?:[A-Za-z]+)?Props\b/g) ?? []),
      ].sort();
      expect(publicPropNames).toEqual(
        [...apiNames, 'TooltipRootProps'].sort()
      );
      const typeSource = fs.readFileSync(
        path.join(
          process.cwd(),
          `packages/${page.platform}/src/components/Tooltip/types.ts`
        ),
        'utf8'
      );
      expect(typeSource).toContain('export type TooltipProps = TooltipRootProps;');
      for (const name of apiNames) {
        const marker = `${prefix}.${name}.${name === 'TooltipProps' ? 'Tooltip' : name}`;
        const start = `<!-- api-docgen:start ${marker} -->`;
        const end = `<!-- api-docgen:end ${marker} -->`;
        expect(api.split(start)).toHaveLength(2);
        expect(api.split(end)).toHaveLength(2);
        expect(generated.split(start)).toHaveLength(2);
        expect(generated.split(end)).toHaveLength(2);
      }
      expect([
        ...generated.matchAll(
          /<!-- api-docgen:start (?:web|native)\.Tooltip\w*Props\./g
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
        expect(generated).toContain('skipDelay');
        expect(generated).not.toContain('native.TooltipProps.TooltipProps');
      } else {
        expect(generated).toContain('closeOnOutsidePress');
        expect(generated).not.toContain('skipDelay');
        expect(generated).not.toContain('web.TooltipProps.TooltipProps');
      }
    }
  );
});
