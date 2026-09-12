import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { assessGithubRelease } = require('./recovery.cjs');

describe('release recovery semantic-release notes compatibility', () => {
  it('accepts canonical semantic-release notes for an already published release', () => {
    const existing = {
      id: 387710111,
      tag_name: 'v2.104.13',
      draft: false,
      prerelease: false,
      name: 'v2.104.13',
      body:
        '## [2.104.13](https://github.com/vellira-dev/vellira/compare/v2.104.12...v2.104.13) (2026-09-12)\n\n\n### Bug Fixes\n\n* **ci:** dedupe PR performance history\n',
    };
    const expected = {
      tagName: 'v2.104.13',
      name: 'v2.104.13',
      body:
        "## What's Changed\n* fix(ci): dedupe PR performance history\n\n**Full Changelog**: https://github.com/vellira-dev/vellira/compare/v2.104.12...v2.104.13",
    };

    expect(assessGithubRelease(existing, expected)).toEqual({
      action: 'none',
      releaseId: 387710111,
    });
  });
});
