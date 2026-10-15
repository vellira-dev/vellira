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
    canonicalAuthorSha256: '__MODAL_REACT_SHA__',
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
    canonicalAuthorSha256: '__MODAL_NATIVE_SHA__',
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
      expect(content).toContain(
        `import { Modal } from '${page.packageName}';`
      );

      const generated = content.slice(
        0,
        content.indexOf('<!-- vellira-component-docs:authored:start -->')
      );
      const prefix = page.platform === 'react' ? 'web' : 'native';
      const apiNames = ['ModalProps', ...page.compoundParts.map((part) => `Modal${part}Props`)];
      for (const name of apiNames) {
        const marker = `${prefix}.${name}.${name}`;
        expect(generated).toContain(`<!-- api-docgen:start ${marker} -->`);
        expect(generated).toContain(`<!-- api-docgen:end ${marker} -->`);
      }
      expect(
        [...generated.matchAll(/<!-- api-docgen:start (?:web|native)\.Modal\w+Props\./g)]
      ).toHaveLength(apiNames.length);
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
