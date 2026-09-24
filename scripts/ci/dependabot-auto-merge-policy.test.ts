import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge.yml'
);
const dependabotConfigPath = resolve(process.cwd(), '.github/dependabot.yml');

async function workflowSource() {
  return readFile(workflowPath, 'utf8');
}

async function dependabotConfigSource() {
  return readFile(dependabotConfigPath, 'utf8');
}

describe('Dependabot auto-merge workflow policy', () => {
  it('requires successful full CI', async () => {
    const source = await workflowSource();

    expect(source).toContain("workflows: ['CI']");
    expect(source).not.toContain(
      "workflows: ['Dependabot Auto Merge Metadata']"
    );
    expect(source).toContain(
      "github.event.workflow_run.conclusion == 'success'"
    );
  });

  it('binds metadata to the CI head', async () => {
    const source = await workflowSource();

    expect(source).toContain('head_sha="$EXPECTED_HEAD_SHA"');
    expect(source).toContain('run.head_sha === expectedHeadSha');
    expect(source).toContain('decision.headSha !== ciHeadSha');
    expect(source).toContain(
      'Dependabot auto-merge decision does not match successful CI head'
    );
  });

  it('orders checks before write credentials', async () => {
    const source = await workflowSource();
    const waitIndex = source.indexOf('Wait for required pull request checks');
    const revalidateIndex = source.indexOf(
      'Revalidate Dependabot pull request after checks'
    );
    const tokenIndex = source.indexOf(
      'Create short-lived merge GitHub App token'
    );
    const mergeIndex = source.indexOf('Merge patch update after full CI');

    expect(waitIndex).toBeGreaterThan(-1);
    expect(revalidateIndex).toBeGreaterThan(waitIndex);
    expect(tokenIndex).toBeGreaterThan(revalidateIndex);
    expect(mergeIndex).toBeGreaterThan(tokenIndex);
    expect(source).toContain('--required');
    expect(source).toContain('--watch');
    expect(source).toContain('--fail-fast');
  });

  it('merges immediately with exact head', async () => {
    const source = await workflowSource();
    const mergeFlagIndex = source.indexOf('--merge');
    const exactHeadIndex = source.indexOf(
      '--match-head-commit "$EXPECTED_HEAD_SHA"'
    );

    expect(mergeFlagIndex).toBeGreaterThan(-1);
    expect(exactHeadIndex).toBeGreaterThan(mergeFlagIndex);
    expect(source).not.toMatch(/^\s+--auto\b/m);
  });

  it('keeps the default token read-only', async () => {
    const source = await workflowSource();

    expect(source).toContain('actions: read');
    expect(source).toContain('checks: read');
    expect(source).toContain('contents: read');
    expect(source).toContain('pull-requests: read');
    expect(source).toContain('statuses: read');
    expect(source).toContain('permission-contents: write');
    expect(source).toContain('permission-pull-requests: write');
  });
});

describe('Dependabot version-update policy', () => {
  it('batches routine updates monthly and bounds PR fan-out', async () => {
    const source = await dependabotConfigSource();
    const monthlyIntervals = source.match(/^\s+interval: monthly$/gm) ?? [];

    expect(monthlyIntervals).toHaveLength(2);
    expect(source).not.toMatch(/^\s+interval: weekly$/m);
    expect(source).toMatch(
      /package-ecosystem: npm[\s\S]*?open-pull-requests-limit: 4/
    );
    expect(source).toMatch(
      /package-ecosystem: github-actions[\s\S]*?open-pull-requests-limit: 2/
    );
  });

  it('groups routine linting and dev-tooling updates', async () => {
    const source = await dependabotConfigSource();
    const groups = source.split('\n    ignore:\n')[0];

    for (const dependency of [
      "'@typescript-eslint/*'",
      'typescript-eslint',
      "'eslint-*'",
      "'stylelint-*'",
      'turbo',
      'esbuild',
      'jsdom',
      'tsx',
      'fast-check',
      'wrangler',
    ]) {
      expect(groups).toContain(`          - ${dependency}`);
    }

    expect(groups).not.toMatch(/^\s+- major$/m);
  });

  it('enforces migration boundaries with ignore rules, not group comments', async () => {
    const source = await dependabotConfigSource();
    const ignore = source.split('\n    ignore:\n')[1];

    expect(ignore).toBeDefined();

    for (const dependency of [
      'react',
      'react-dom',
      'storybook',
      'vite',
      'vitest',
      'next',
      'typescript',
      'eslint',
      'prettier',
      'stylelint',
      'turbo',
      'jsdom',
      'tsx',
      'fast-check',
      'wrangler',
    ]) {
      expect(ignore).toContain(
        `      - dependency-name: ${dependency}\n        update-types:\n          - version-update:semver-major`
      );
    }

    expect(ignore).toContain(
      "      - dependency-name: react-native\n" +
        '        update-types:\n' +
        '          - version-update:semver-minor\n' +
        '          - version-update:semver-major'
    );
    expect(ignore).toContain(
      "      - dependency-name: '@babel/core'\n" +
        '        update-types:\n' +
        '          - version-update:semver-major'
    );
    expect(ignore).toContain(
      '      - dependency-name: esbuild\n' +
        '        update-types:\n' +
        '          - version-update:semver-minor\n' +
        '          - version-update:semver-major'
    );
  });
});
