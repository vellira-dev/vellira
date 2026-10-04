import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRootFile = (path: string) => readFileSync(resolve(path), 'utf8');

const rootPackage = JSON.parse(readRootFile('package.json')) as {
  scripts: Record<string, string>;
};
const storybookPackage = JSON.parse(
  readRootFile('apps/react-storybook/package.json')
) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const rootScripts = rootPackage.scripts;
const storybookScripts = storybookPackage.scripts;
const compose = readRootFile('compose.yaml');
const ci = readRootFile('.github/workflows/ci.yml');
const buttonVisualSpec = readRootFile(
  'apps/react-storybook/e2e/web-button.spec.ts'
);

const playwrightVersion = storybookPackage.devDependencies['@playwright/test'];
const canonicalImage = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;
const canonicalEnvironment = `playwright-v${playwrightVersion}-noble`;

describe('Storybook visual regression contract', () => {
  it('keeps host-native E2E separate from canonical screenshot regression', () => {
    expect(storybookScripts['test:e2e']).toContain('--grep-invert @visual');
    expect(storybookScripts['test:e2e:visual']).toBe(
      'node ../../scripts/visual/run.mjs'
    );
    const runner = readRootFile('scripts/visual/run.mjs');
    expect(runner).toContain('assert-canonical-visual-environment.mjs');
    expect(runner).toContain("'@visual'");
    const invalid = spawnSync(
      process.execPath,
      ['../../scripts/visual/run.mjs'],
      {
        cwd: resolve('apps/react-storybook'),
        encoding: 'utf8',
        env: { ...process.env, VELLIRA_VISUAL_ENVIRONMENT: 'unsupported' },
      }
    );
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain(
      'Canonical visual environment check failed'
    );
    expect(buttonVisualSpec).toContain("test('@visual");
    expect(buttonVisualSpec).toContain('maxDiffPixelRatio: 0.02');
  });

  it('uses the same pinned Playwright image contract for Docker and CI', () => {
    expect(playwrightVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(compose).toContain(`image: ${canonicalImage}`);
    expect(compose).toContain('platform: linux/amd64');
    expect(compose).toContain(
      `VELLIRA_VISUAL_ENVIRONMENT: "${canonicalEnvironment}"`
    );
    expect(ci).toContain(`image: ${canonicalImage}`);
    expect(ci).toContain('name: Visual regression');
    expect(ci).toContain(`VELLIRA_VISUAL_ENVIRONMENT: ${canonicalEnvironment}`);
  });

  it('regenerates baselines only through the canonical visual Docker path', () => {
    expect(rootScripts['test:e2e:web:visual:docker']).toBe(
      'pnpm docker:e2e:visual'
    );
    expect(rootScripts['docker:e2e:visual']).toContain(
      'PLAYWRIGHT_SCRIPT=test:e2e:visual'
    );
    expect(rootScripts['docker:e2e:update']).toContain(
      'PLAYWRIGHT_SCRIPT=test:e2e:visual'
    );
    expect(rootScripts['docker:e2e:update']).toContain(
      'PLAYWRIGHT_ARGS=--update-snapshots'
    );
  });
});
