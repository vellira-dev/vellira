import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateComponentWebsitePage,
  resolveWebsiteComponentProfile,
} from './website';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-website-')
  );

  tempRoots.push(root);

  return root;
}

beforeEach(() => {
  vi.mocked(spawnSync).mockReset();
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});

describe('generateComponentWebsitePage', () => {
  it('passes the canonical component profile to the page generator', () => {
    vi.mocked(spawnSync).mockReturnValue({
      pid: 1,
      output: [],
      stdout: '',
      stderr: '',
      status: 0,
      signal: null,
    });

    generateComponentWebsitePage({
      root: '/repo',
      componentName: 'Accordion',
      profile: 'compound',
      category: 'navigation',
    });

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith(
      'pnpm',
      [
        'create:component-page',
        'Accordion',
        '--force',
        '--profile=compound',
        '--category=navigation',
      ],
      {
        cwd: '/repo',
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
  });

  it('reports created and updated managed website artifacts', () => {
    const root = createTempRoot();

    const registryDir = path.join(
      root,
      'apps/website/src/component-catalog/registry'
    );

    const componentDir = path.join(
      root,
      'apps/website/src/component-catalog/components/Avatar'
    );

    fs.mkdirSync(registryDir, {
      recursive: true,
    });

    const componentPagesFile = path.join(registryDir, 'componentPages.ts');

    const componentsRegistryFile = path.join(registryDir, 'components.ts');
    const componentPresentationRegistryFile = path.join(
      registryDir,
      'componentPresentation.ts'
    );
    const generatedCatalogPreviewsFile = path.join(
      registryDir,
      'generatedCatalogPreviews.ts'
    );

    fs.writeFileSync(componentPagesFile, 'before component pages\n');
    fs.writeFileSync(componentsRegistryFile, 'before components\n');
    fs.writeFileSync(
      componentPresentationRegistryFile,
      'before component presentation\n'
    );
    fs.writeFileSync(
      generatedCatalogPreviewsFile,
      'before generated catalog previews\n'
    );

    const usageFile = path.join(componentDir, 'AvatarUsage.tsx');
    const catalogPreviewFile = path.join(
      componentDir,
      'AvatarCatalogPreview.tsx'
    );
    const unrelatedRegistryFile = path.join(
      registryDir,
      'relatedComponents.ts'
    );

    vi.mocked(spawnSync).mockImplementation(() => {
      fs.mkdirSync(componentDir, {
        recursive: true,
      });

      fs.writeFileSync(usageFile, 'generated usage\n');
      fs.writeFileSync(catalogPreviewFile, 'generated catalog preview\n');
      fs.writeFileSync(componentPagesFile, 'after component pages\n');
      fs.writeFileSync(
        componentPresentationRegistryFile,
        'after component presentation\n'
      );
      fs.writeFileSync(
        generatedCatalogPreviewsFile,
        'after generated catalog previews\n'
      );
      fs.writeFileSync(unrelatedRegistryFile, 'unrelated registry\n');

      return {
        pid: 1,
        output: [],
        stdout: '',
        stderr: '',
        status: 0,
        signal: null,
      };
    });

    const result = generateComponentWebsitePage({
      root,
      componentName: 'Avatar',
      profile: 'base',
      category: 'data-display',
    });

    expect(result).toEqual({
      createdFiles: [catalogPreviewFile, usageFile].sort(),
      updatedFiles: [
        componentPagesFile,
        componentPresentationRegistryFile,
        generatedCatalogPreviewsFile,
      ].sort(),
    });
    expect(result.createdFiles).not.toContain(unrelatedRegistryFile);
    expect(result.updatedFiles).not.toContain(unrelatedRegistryFile);
  });

  it('maps the base generator profile to primitive website profile', () => {
    expect(resolveWebsiteComponentProfile('base')).toBe('primitive');
  });

  it('fails when the component page generator exits unsuccessfully', () => {
    vi.mocked(spawnSync).mockReturnValue({
      pid: 1,
      output: [],
      stdout: 'generator output',
      stderr: 'generator failed',
      status: 1,
      signal: null,
    });

    expect(() =>
      generateComponentWebsitePage({
        root: '/repo',
        componentName: 'Avatar',
        profile: 'base',
        category: 'data-display',
      })
    ).toThrow('Website component page generation failed for Avatar.');
  });

  it('fails when the component page generator cannot be started', () => {
    vi.mocked(spawnSync).mockReturnValue({
      pid: 1,
      output: [],
      stdout: '',
      stderr: '',
      status: null,
      signal: null,
      error: new Error('spawn failed'),
    });

    expect(() =>
      generateComponentWebsitePage({
        root: '/repo',
        componentName: 'Avatar',
        profile: 'base',
        category: 'data-display',
      })
    ).toThrow(
      'Website component page generation failed for Avatar: spawn failed'
    );
  });
});
