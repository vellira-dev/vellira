import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { formFieldDocs } from '../../../apps/docs/src/component-docs/FormField.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parts = ['Label', 'Description', 'Control', 'Message'] as const;

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/form-field.md',
    sourceBlob: 'cd0de505194b68fbcbbf2234b5e97a19cc40b40c',
    packageName: '@vellira-ui/react',
    canonicalAuthorSha256:
      'c4181414a6c9eb9a9aa752090d73ea04235f302320892eaf246e08192da8e075',
    authorEvidence: [
      'story="formField.complete"',
      '## Practical Usage Guidance',
      '## Contract',
      '## Web Notes',
      '## Messages And Errors',
      '## Optional And Info Content',
      '## Layout',
      '## Custom Controls',
      '## Compound API',
      '## Native Notes',
      '## Further Reading',
      'aria-labelledby',
      'aria-describedby',
      'FormField.Control',
      'bindControl={false}',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/form-field.md',
    sourceBlob: 'ee6a4fb22d1bbffb687893351eb85032c2a16175',
    packageName: '@vellira-ui/react-native',
    canonicalAuthorSha256:
      '73b9bdca55ea80b7181a750ebf63c30499d1b8466b10488372ad7061c82b449a',
    authorEvidence: [
      '## Basic Usage',
      '## Layout',
      '## Description, Message, And Error',
      '## Label Information And Actions',
      '## Styling',
      '## Additional Accessibility Details',
      '## Further Reading',
      'accessibilityLabel',
      "labelPosition='start'",
      'CustomSecretControl',
      'Error text uses a polite live region.',
    ],
  },
] as const;

describe('published FormField docs safe legacy adoption', () => {
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
        throw new Error('Missing trusted FormField authored region');
      }

      const contract = formFieldDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(
        `import { FormField } from '${page.packageName}';`
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
        'FormFieldProps',
        ...parts.map((part) => `FormField${part}Props`),
      ];
      const publicIndex = fs.readFileSync(
        path.join(process.cwd(), `packages/${page.platform}/src/index.ts`),
        'utf8'
      );
      const publicPropNames = [
        ...new Set(
          publicIndex.match(/\bFormField(?:[A-Za-z]+)?Props\b/g) ?? []
        ),
      ].sort();
      expect(publicPropNames).toEqual([...apiNames].sort());
      for (const name of apiNames) {
        const marker = `${prefix}.${name}.${name === 'FormFieldProps' ? 'FormField' : name}`;
        const start = `<!-- api-docgen:start ${marker} -->`;
        const end = `<!-- api-docgen:end ${marker} -->`;
        expect(api.split(start)).toHaveLength(2);
        expect(api.split(end)).toHaveLength(2);
        expect(generated.split(start)).toHaveLength(2);
        expect(generated.split(end)).toHaveLength(2);
      }
      expect([
        ...generated.matchAll(
          /<!-- api-docgen:start (?:web|native)\.FormField\w*Props\./g
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
        // The legacy guide records Web ARIA wiring in its authored Contract
        // instead of a separate Accessibility H2; preserve that contract
        // verbatim while generator-owned guidance provides the H2.
        expect(region.content).not.toContain('## Accessibility');
        expect(region.content).toContain('## Contract');
        expect(region.content).toContain('aria-labelledby');
        expect(region.content).toContain('aria-describedby');
        expect(generated).toContain('bindControl');
        expect(generated).not.toContain('native.FormFieldProps.FormField');
      } else {
        expect(region.content).toContain('## Additional Accessibility Details');
        expect(generated).toContain('controlStyle');
        expect(generated).not.toContain('bindControl');
        expect(generated).not.toContain('web.FormFieldProps.FormField');
      }
    }
  );
});
