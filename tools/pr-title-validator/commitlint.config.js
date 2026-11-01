import canonicalConfig from '../../commitlint.config.js';

// GitHub supplies this flag only for PRs authored by the verified Dependabot bot.
// Retain the 100-character policy for human-authored and other automation PRs.
const isTrustedDependabotPR = process.env.VELLIRA_TRUSTED_DEPENDABOT_PR === 'true';

export default {
  ...canonicalConfig,
  rules: {
    ...canonicalConfig.rules,
    'header-max-length': [2, 'always', isTrustedDependabotPR ? 140 : 100],
  },
};
