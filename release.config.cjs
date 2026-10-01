module.exports = {
  branches: ['main'],
  repositoryUrl: 'https://github.com/vellira-dev/vellira.git',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',

    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'node scripts/sync-package-versions.cjs ${nextRelease.version} && pnpm install --lockfile-only',
      },
    ],
    './scripts/semantic-release-packages.cjs',

    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
