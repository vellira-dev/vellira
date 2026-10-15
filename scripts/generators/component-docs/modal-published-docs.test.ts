import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { modalDocs } from '../../../apps/docs/src/component-docs/Modal.docs';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const pages = [
  {
    platform: 'react',
    relativePath: 'apps/docs/src/react/modal.md',
    packageName: '@vellira-ui/react',
    canonicalAuthorSha256:
      '9010e20c96d7e50afcc0ccf4a03bf75809953bc6e465bae8e77a59f4cfb7f8ae',
    compoundParts: [
      'Trigger',
      'Overlay',
      'Content',
      'Header',
      'Body',
      'Footer',
      'Close',
    ],
    authorEvidence: [
      'story="modal.basic"',
      '## Practical Usage Guidance',
      '## Destructive Confirmation',
      '## Real Example: Invite Teammate',
      '## Anatomy',
      '## Styling',
      '## Additional Accessibility Details',
      '## Further Reading',
      "role='alertdialog'",
      'Modal.Description',
      'Modal.Close',
      'InviteTeammateDialog',
    ],
  },
  {
    platform: 'react-native',
    relativePath: 'apps/docs/src/react-native/modal.md',
    packageName: '@vellira-ui/react-native',
    canonicalAuthorSha256:
      '82721dccdadb5024a8bf1ef24cd95a991bd748c15f022a638dfe113c98f13e54',
    compoundParts: [
      'Trigger',
      'Overlay',
      'Content',
      'Header',
      'Title',
      'Description',
      'Body',
      'Footer',
      'Close',
    ],
    authorEvidence: [
      '## Basic Usage',
      '## Controlled And Uncontrolled',
      '## Outside Dismissal',
      '## Animation',
      '## Destructive Confirmation',
      '## Compound Components',
      '## Additional Accessibility Details',
      '## Further Reading',
      "animation='fade'",
      'Modal.Overlay',
      'onPress={handleDelete}',
      'closeOnEscape',
    ],
  },
] as const;

describe('published Modal documentation safe adoption', () => {
  it.each(pages)(
    'preserves complete $platform Modal author text and public API parts',
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

      const authored = readAuthoredRegion({
        content,
        filePath: page.relativePath,
      });
      expect(authored.valid).toBe(true);
      if (!authored.valid || !authored.found) {
        throw new Error('Modal published authored region was not preserved');
      }
      const contract = modalDocs.platforms[page.platform];
      expect(content).toContain(contract.title);
      expect(content).toContain(contract.description);
      expect(content).toContain(`import { Modal } from '${page.packageName}';`);

      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      const prefix = page.platform === 'react' ? 'web' : 'native';
      const canonicalApi = fs.readFileSync(
        path.join(process.cwd(), `packages/${page.platform}/API.md`),
        'utf8'
      );
      const apiNames = [
        'ModalProps',
        ...page.compoundParts.map((part) => `Modal${part}Props`),
      ];
      for (const name of apiNames) {
        const marker = `${prefix}.${name}.${name}`;
        const start = `<!-- api-docgen:start ${marker} -->`;
        const end = `<!-- api-docgen:end ${marker} -->`;
        // Each published part must be sourced once from its exact platform's
        // canonical API.md, with no duplicate or cross-platform authority.
        expect(canonicalApi.split(start)).toHaveLength(2);
        expect(canonicalApi.split(end)).toHaveLength(2);
        expect(generated.split(start)).toHaveLength(2);
        expect(generated.split(end)).toHaveLength(2);
      }
      expect([
        ...generated.matchAll(
          /<!-- api-docgen:start (?:web|native)\.Modal\w*Props\./g
        ),
      ]).toHaveLength(apiNames.length);
      for (const fragment of page.authorEvidence) {
        expect(authored.content).toContain(fragment);
      }
      expect(authored.content).not.toContain(
        '<!-- Add manually authored content for this component here. -->'
      );

      // The only approved changes to the canonical legacy author body are
      // reversible heading aliases. Preserve every other authored character.
      let recovered = authored.content
        .trim()
        .replace('## Additional Accessibility Details', '## Accessibility')
        .replace('## Further Reading', '## See Also');
      if (page.platform === 'react') {
        recovered = recovered.replace(
          '## Practical Usage Guidance',
          '## When To Use'
        );
      }
      expect(sha256(recovered)).toBe(page.canonicalAuthorSha256);

      const headings = content
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');
      expect(headings.length).toBe(new Set(headings).size);

      if (page.platform === 'react') {
        expect(generated).toContain('ariaLabel');
        expect(generated).not.toContain('native.ModalTitleProps');
      } else {
        expect(generated).toContain('accessibilityLabel');
        expect(generated).toContain('native.ModalTitleProps');
        expect(generated).not.toContain('web.ModalContentProps');
      }
    }
  );
});
