import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkboxDocs } from '../../../apps/docs/src/component-docs/Checkbox.docs';

import { readAuthoredRegion } from './authored-region';
import { adoptLegacyComponentDocs } from './adopt-legacy-docs';
import { inspectComponentDocAuthority } from './legacy-adoption';

const root = process.cwd();
const tempDirs: string[] = [];

function fixture() {
  const docsRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-checkbox-docs-pilot-')
  );
  tempDirs.push(docsRoot);
  const files = ['react', 'react-native'].map((platform) => {
    const target = path.join(docsRoot, platform, 'checkbox.md');
    const contract =
      checkboxDocs.platforms[platform as 'react' | 'react-native'];
    const fence = String.fromCharCode(96).repeat(3);
    const body =
      platform === 'react'
        ? [
            'Checkbox represents independent choices.',
            '',
            '## When To Use',
            '',
            'Use Checkbox for independent form selections.',
            '',
            '## Props',
            '',
            '| Prop | Purpose |',
            '| ---- | ------- |',
            '| checked | Controlled value |',
            '',
            '## Select All with an Indeterminate React Checkbox',
            '',
            'An indeterminate state summarizes partially selected rows.',
            '',
            fence + 'tsx',
            'export function ProjectSelection() {',
            "  return <Checkbox indeterminate label='Select all' />;",
            '}',
            fence,
            '',
            '## Real Example: Notification Preferences',
            '',
            'A curated settings row illustrates controlled selection.',
            '',
            '## Accessibility',
            '',
            'Use descriptive labels and preserve mixed state announcements.',
          ].join('\n')
        : [
            'React Native Checkbox represents an independent boolean selection.',
            '',
            '## Controlled And Uncontrolled',
            '',
            fence + 'tsx',
            "<Checkbox checked={enabled} onCheckedChange={setEnabled} label='Enabled' />",
            fence,
            '',
            '## Indeterminate State',
            '',
            'Use indeterminate only for partial group selection.',
            '',
            '## Custom Icons And Color',
            '',
            'Prefer default icons unless the application requires custom ones.',
            '',
            '## Accessibility',
            '',
            'Use accessibilityRole and an accessible label.',
          ].join('\n');
    const original = [
      '---',
      'title: ' + contract.title,
      'description: ' + contract.description,
      '---',
      '',
      '# Checkbox',
      '',
      body,
      '',
    ].join('\n');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, original);
    return { platform, target, original };
  });
  return { docsRoot, files };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Checkbox legacy docs adoption pilot', () => {
  it('previews both platforms with source receipts without touching original Markdown', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });

    expect(preview.status).toBe('preview');
    expect(preview.entries.map((entry) => entry.platform)).toEqual([
      'react',
      'react-native',
    ]);
    for (const row of preview.entries) {
      expect(row.originalSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.generatedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.preservedAuthorSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.preservedAuthorBytes).toBeGreaterThan(100);
    }
    for (const file of test.files) {
      expect(fs.readFileSync(file.target, 'utf8')).toBe(file.original);
    }
  });

  it('requires both pinned source digests and preserves originals on rejection', async () => {
    const test = fixture();
    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: {
          react: '0'.repeat(64),
          'react-native': '0'.repeat(64),
        },
      })
    ).rejects.toThrow('pinned source SHA-256');
    for (const file of test.files) {
      expect(fs.readFileSync(file.target, 'utf8')).toBe(file.original);
    }
  });

  it('preserves both editorial bodies, generates reproducibly and remains idempotent', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const expectedOriginalSha256 = Object.fromEntries(
      preview.entries.map((entry) => [entry.platform, entry.originalSha256])
    );
    const adopted = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
      write: true,
      expectedOriginalSha256,
    });

    expect(adopted.status).toBe('adopted');
    const originals = new Map(
      test.files.map((file) => [file.platform, file.original])
    );
    for (const file of test.files) {
      const generated = fs.readFileSync(file.target, 'utf8');
      expect(generated).not.toBe(file.original);
      expect(
        inspectComponentDocAuthority({
          content: generated,
          filePath: file.target,
        }).state
      ).toBe('managed');
      const region = readAuthoredRegion({
        content: generated,
        filePath: file.target,
      });
      expect(region.valid).toBe(true);
      if (!region.valid)
        throw new Error('Invalid authored region after migration');
      const original = originals.get(file.platform) ?? '';
      expect(original).toContain('# Checkbox');
      if (file.platform === 'react') {
        expect(region.content).toContain(
          'Select All with an Indeterminate React Checkbox'
        );
        expect(region.content).toContain('export function ProjectSelection()');
        expect(region.content).toContain(
          'Real Example: Notification Preferences'
        );
        expect(region.content).toContain('## Props');
      } else {
        expect(region.content).toContain('## Controlled And Uncontrolled');
        expect(region.content).toContain('## Indeterminate State');
        expect(region.content).toContain('## Custom Icons And Color');
      }
    }

    const unchanged = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    expect(unchanged.status).toBe('up-to-date');
    expect(unchanged.entries.map((entry) => entry.generatedSha256)).toEqual(
      adopted.entries.map((entry) => entry.generatedSha256)
    );
  });

  it('rejects a tampered native page without partially migrating React', async () => {
    const test = fixture();
    const native = test.files.find(
      (entry) => entry.platform === 'react-native'
    );
    if (!native) throw new Error('Expected native fixture');
    fs.appendFileSync(
      native.target,
      '\n<!-- vellira-component-docs:authored:start -->\nUntrusted ownership\n'
    );
    const before = test.files.map((entry) =>
      fs.readFileSync(entry.target, 'utf8')
    );

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
      })
    ).rejects.toThrow('expected a real legacy or managed page');
    test.files.forEach((entry, index) => {
      expect(fs.readFileSync(entry.target, 'utf8')).toBe(before[index]);
    });
  });

  it('rejects missing companion files and never creates an unrequested platform', async () => {
    const test = fixture();
    const native = test.files.find(
      (entry) => entry.platform === 'react-native'
    );
    if (!native) throw new Error('Expected native fixture');
    fs.rmSync(native.target);
    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
      })
    ).rejects.toThrow('expected a real legacy or managed page');
    expect(fs.existsSync(native.target)).toBe(false);
    expect(fs.readFileSync(test.files[0].target, 'utf8')).toBe(
      test.files[0].original
    );
  });

  it.each(['react', 'react-native'] as const)(
    'rejects unexpected YAML frontmatter on %s without modifying either page',
    async (platform) => {
      const test = fixture();
      const extra = test.files.find((file) => file.platform === platform);
      if (!extra) throw new Error('Missing frontmatter fixture');
      const unexpected = extra.original.replace(
        '\n---\n\n# Checkbox',
        '\nsidebar: hidden\n---\n\n# Checkbox'
      );
      expect(unexpected).not.toBe(extra.original);
      fs.writeFileSync(extra.target, unexpected);

      await expect(
        adoptLegacyComponentDocs({
          root,
          docsRoot: test.docsRoot,
          componentName: 'Checkbox',
        })
      ).rejects.toThrow('unsupported YAML frontmatter');

      const after = new Map(
        test.files.map((file) => [
          file.platform,
          fs.readFileSync(file.target, 'utf8'),
        ])
      );
      expect(after.get(platform)).toBe(unexpected);
      for (const file of test.files) {
        if (file.platform !== platform) {
          expect(after.get(file.platform)).toBe(file.original);
        }
      }
    }
  );

  it.each([
    ['duplicate title', '\ntitle: Forged duplicate'],
    ['editorial frontmatter comment', '\n# Keep this editorial note'],
    ['nested redirect metadata', '\nredirects:\n  - /old-checkbox'],
  ] as const)(
    'rejects %s rather than discarding YAML on adoption',
    async (_reason, additionalYaml) => {
      const test = fixture();
      const react = test.files.find((file) => file.platform === 'react');
      if (!react) throw new Error('Missing React source fixture');
      const changed = react.original.replace(
        '\n---\n\n# Checkbox',
        additionalYaml + '\n---\n\n# Checkbox'
      );
      expect(changed).not.toBe(react.original);
      fs.writeFileSync(react.target, changed);

      await expect(
        adoptLegacyComponentDocs({
          root,
          docsRoot: test.docsRoot,
          componentName: 'Checkbox',
        })
      ).rejects.toThrow('unsupported YAML frontmatter');

      for (const file of test.files) {
        expect(fs.readFileSync(file.target, 'utf8')).toBe(
          file.platform === 'react' ? changed : file.original
        );
      }
    }
  );

  it('rejects a concurrent source change during staging before writing either page', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const native = test.files.find((file) => file.platform === 'react-native');
    const react = test.files.find((file) => file.platform === 'react');
    if (!native || !react) throw new Error('Missing platform fixture');

    const writeFile = fs.writeFileSync;
    let injected = false;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      Reflect.apply(writeFile, fs, args);
      const file = args[0];
      if (
        !injected &&
        typeof file === 'string' &&
        file.includes('vellira-docs-adoption-') &&
        file.endsWith(path.join('react-native', 'checkbox.md'))
      ) {
        injected = true;
        fs.appendFileSync(native.target, '\nExternal native editor change.\n');
      }
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow('source changed since SHA-256 validation');
    expect(injected).toBe(true);
    expect(fs.readFileSync(react.target, 'utf8')).toBe(react.original);
    expect(fs.readFileSync(native.target, 'utf8')).toBe(
      native.original + '\nExternal native editor change.\n'
    );
  });

  it('rechecks each platform and rolls back only the already-written page', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const react = test.files.find((file) => file.platform === 'react');
    const native = test.files.find((file) => file.platform === 'react-native');
    if (!react || !native) throw new Error('Missing platform fixture');

    const renameFile = fs.renameSync;
    let injected = false;
    vi.spyOn(fs, 'renameSync').mockImplementation((...args) => {
      Reflect.apply(renameFile, fs, args);
      if (
        !injected &&
        args[1] === react.target &&
        path.basename(String(args[0])) === 'generated.md'
      ) {
        injected = true;
        fs.appendFileSync(
          native.target,
          '\nNative editor changed during commit.\n'
        );
      }
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow('source changed since SHA-256 validation');
    expect(injected).toBe(true);
    expect(fs.readFileSync(react.target, 'utf8')).toBe(react.original);
    expect(fs.readFileSync(native.target, 'utf8')).toBe(
      native.original + '\nNative editor changed during commit.\n'
    );
  });

  it('refuses to roll back a generated file modified by another editor', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const react = test.files.find((file) => file.platform === 'react');
    const native = test.files.find((file) => file.platform === 'react-native');
    if (!react || !native) throw new Error('Missing platform fixture');

    const renameFile = fs.renameSync;
    let injected = false;
    vi.spyOn(fs, 'renameSync').mockImplementation((...args) => {
      Reflect.apply(renameFile, fs, args);
      if (
        !injected &&
        args[1] === native.target &&
        path.basename(String(args[0])) === 'generated.md'
      ) {
        injected = true;
        fs.appendFileSync(
          react.target,
          '\nExternal edit after React migration.\n'
        );
      }
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow(
      'cannot safely roll back documents edited after this migration'
    );
    expect(injected).toBe(true);
    expect(fs.readFileSync(react.target, 'utf8')).toContain(
      'External edit after React migration.'
    );
    expect(fs.readFileSync(native.target, 'utf8')).toBe(native.original);
  });

  it('keeps both source files intact on a partial sibling-temp write failure', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const originalWrite = fs.writeFileSync;
    let injected = false;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      const destination = String(args[0]);
      if (
        !injected &&
        destination.includes('.vellira-docs-commit-') &&
        destination.endsWith('generated.md')
      ) {
        injected = true;
        Reflect.apply(originalWrite, fs, [args[0], 'PARTIAL WRITTEN BY DISK', args[2]]);
        throw new Error('Simulated ENOSPC during staged write');
      }
      Reflect.apply(originalWrite, fs, args);
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow('Simulated ENOSPC during staged write');

    expect(injected).toBe(true);
    for (const file of test.files) {
      expect(fs.readFileSync(file.target, 'utf8')).toBe(file.original);
      expect(
        fs.readdirSync(path.dirname(file.target)).filter((name) =>
          name.startsWith('.vellira-docs-commit-')
        )
      ).toEqual([]);
    }
  });

  it('restores the first page atomically when the second replacement fails', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const native = test.files.find((entry) => entry.platform === 'react-native');
    if (!native) throw new Error('Expected React Native fixture');

    const originalRename = fs.renameSync;
    let injected = false;
    vi.spyOn(fs, 'renameSync').mockImplementation((...args) => {
      if (
        !injected &&
        args[1] === native.target &&
        path.basename(String(args[0])) === 'generated.md'
      ) {
        injected = true;
        throw new Error('Simulated EIO during second atomic rename');
      }
      Reflect.apply(originalRename, fs, args);
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow('Simulated EIO during second atomic rename');

    expect(injected).toBe(true);
    for (const file of test.files) {
      expect(fs.readFileSync(file.target, 'utf8')).toBe(file.original);
      expect(
        fs.readdirSync(path.dirname(file.target)).filter((name) =>
          name.startsWith('.vellira-docs-commit-')
        )
      ).toEqual([]);
    }
  });

  it('preserves existing file mode across both atomic replacements', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    for (const file of test.files) {
      fs.chmodSync(file.target, 0o640);
    }
    // The pin hashes file contents, not permissions.
    const result = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
      write: true,
      expectedOriginalSha256: Object.fromEntries(
        preview.entries.map((entry) => [entry.platform, entry.originalSha256])
      ),
    });

    expect(result.status).toBe('adopted');
    for (const file of test.files) {
      expect(fs.statSync(file.target).mode & 0o777).toBe(0o640);
      expect(
        fs.readdirSync(path.dirname(file.target)).filter((name) =>
          name.startsWith('.vellira-docs-commit-')
        )
      ).toEqual([]);
    }
  });

  it('reports failed rollback without truncating a successfully replaced page', async () => {
    const test = fixture();
    const preview = await adoptLegacyComponentDocs({
      root,
      docsRoot: test.docsRoot,
      componentName: 'Checkbox',
    });
    const react = test.files.find((entry) => entry.platform === 'react');
    const native = test.files.find((entry) => entry.platform === 'react-native');
    if (!react || !native) throw new Error('Missing platform fixture');

    const originalRename = fs.renameSync;
    let failedNative = false;
    let failedRollback = false;
    vi.spyOn(fs, 'renameSync').mockImplementation((...args) => {
      const source = path.basename(String(args[0]));
      if (!failedNative && source === 'generated.md' && args[1] === native.target) {
        failedNative = true;
        throw new Error('Simulated native rename EIO');
      }
      if (!failedRollback && source === 'original.md' && args[1] === react.target) {
        failedRollback = true;
        throw new Error('Simulated rollback rename EIO');
      }
      Reflect.apply(originalRename, fs, args);
    });

    await expect(
      adoptLegacyComponentDocs({
        root,
        docsRoot: test.docsRoot,
        componentName: 'Checkbox',
        write: true,
        expectedOriginalSha256: Object.fromEntries(
          preview.entries.map((entry) => [entry.platform, entry.originalSha256])
        ),
      })
    ).rejects.toThrow('cannot safely roll back documents edited after this migration');

    expect(failedNative).toBe(true);
    expect(failedRollback).toBe(true);
    const preservedGenerated = fs.readFileSync(react.target, 'utf8');
    expect(preservedGenerated).toContain(
      '<!-- Generated by scripts/generators/component-docs/generate-component-docs.ts.'
    );
    expect(preservedGenerated).toContain('## API');
    expect(fs.readFileSync(native.target, 'utf8')).toBe(native.original);
  });

  it('keeps published Checkbox headings unique across both platforms', () => {
    for (const platform of ['react', 'react-native'] as const) {
      const filePath = path.join(
        root,
        'apps/docs/src',
        platform,
        'checkbox.md'
      );
      const page = fs.readFileSync(filePath, 'utf8');
      const headings = page
        .split(/\r?\n/)
        .filter((line) => line.startsWith('## '));

      expect(new Set(headings).size).toBe(headings.length);
      expect(headings).toContain('## When To Use');
      expect(headings).toContain('## Accessibility');
      expect(headings).toContain('## See Also');

      const region = readAuthoredRegion({ content: page, filePath });
      expect(region.valid).toBe(true);
      if (!region.valid) {
        throw new Error('Expected a valid published authored region');
      }
      expect(region.content).toContain('## Additional Accessibility Details');
      expect(region.content).toContain('## Further Reading');
      if (platform === 'react') {
        expect(region.content).toContain('## Practical Usage Guidance');
        expect(region.content).toContain('export function ProjectSelection()');
        expect(region.content).toContain(
          'Real Example: Notification Preferences'
        );
      } else {
        expect(region.content).toContain('## Controlled And Uncontrolled');
        expect(region.content).toContain('## Indeterminate State');
      }
    }
  });
});
