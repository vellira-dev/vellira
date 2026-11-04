const trustedDependabotPR = process.env.VELLIRA_TRUSTED_DEPENDABOT_PR === 'true';

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Only trusted GitHub PR author metadata can raise this bound.
    // All other PRs retain the canonical 100-character maximum.
    'header-max-length': [2, 'always', trustedDependabotPR ? 140 : 100],
  },
};
