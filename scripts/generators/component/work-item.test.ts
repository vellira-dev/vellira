import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertGovernedWorkItemMatchesRepository,
  parseGovernedGitHubWorkItem,
  parseGovernedGitHubWorkItemUrl,
} from './work-item';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('governed component work-item authority', () => {
  it('parses one exact GitHub issue identity', () => {
    const expected = {
      provider: 'github',
      repository: 'vellira-dev/vellira',
      issue: '#1283',
    } as const;

    expect(parseGovernedGitHubWorkItem(expected)).toEqual(expected);
    expect(
      parseGovernedGitHubWorkItemUrl(
        'https://github.com/vellira-dev/vellira/issues/1283'
      )
    ).toEqual(expected);
  });

  it.each([
    { provider: 'github', repository: 'vellira-dev/vellira', issue: '1283' },
    { provider: 'github', repository: 'vellira-dev/vellira', issue: '#0' },
    { provider: 'github', repository: 'vellira-dev/vellira', issue: '#01' },
    { provider: 'gitlab', repository: 'vellira-dev/vellira', issue: '#1283' },
    {
      provider: 'github',
      repository: 'vellira-dev/vellira',
      issue: '#1283',
      title: 'untrusted text',
    },
  ])('rejects malformed authority %#', (value) => {
    expect(() => parseGovernedGitHubWorkItem(value)).toThrow();
  });

  it.each([
    'http://github.com/vellira-dev/vellira/issues/1283',
    'https://github.com/vellira-dev/vellira/issues/1283?apply=true',
    'https://github.com/vellira-dev/vellira/pull/1283',
    'https://example.com/vellira-dev/vellira/issues/1283',
  ])('rejects non-canonical URL %s', (value) => {
    expect(() => parseGovernedGitHubWorkItemUrl(value)).toThrow(
      '--work-item must be an exact'
    );
  });

  it('binds provenance to the tracked token package repository', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-work-item-'));
    roots.push(root);
    const packageDir = path.join(root, 'packages/tokens');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        repository: {
          type: 'git',
          url: 'git+https://github.com/vellira-dev/vellira.git',
        },
      })
    );

    expect(() =>
      assertGovernedWorkItemMatchesRepository({
        root,
        workItem: {
          provider: 'github',
          repository: 'vellira-dev/vellira',
          issue: '#1283',
        },
      })
    ).not.toThrow();

    expect(() =>
      assertGovernedWorkItemMatchesRepository({
        root,
        workItem: {
          provider: 'github',
          repository: 'attacker/fork',
          issue: '#1283',
        },
      })
    ).toThrow('component-token-work-item-repository-mismatch');
  });
});
