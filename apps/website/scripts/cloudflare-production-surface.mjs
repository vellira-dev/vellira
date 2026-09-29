export const PRODUCTION_DEPLOYMENT_PATH_PATTERNS = Object.freeze([
  'apps/website/**',
  'apps/react-storybook/scripts/cloudflare-website-smoke.mjs',
  'apps/react-storybook/scripts/cloudflare-blog-metrics-smoke-policy.mjs',
  'apps/react-storybook/scripts/cloudflare-blog-metrics-smoke-policy.test.mjs',
  'apps/react-storybook/scripts/cloudflare-static-chunk-smoke.mjs',
  'apps/react-storybook/scripts/cloudflare-navigation-soak.mjs',
  'apps/react-storybook/scripts/cloudflare-browser-diagnostics.mjs',
  'apps/react-storybook/scripts/cloudflare-browser-diagnostics.test.mjs',
  'packages/**',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'patches/**',
  'turbo.json',
  'tsconfig.base.json',
  '.github/workflows/deploy-website-cloudflare-staging.yml',
  '.github/workflows/deploy-website-cloudflare-production.yml',
]);

function normalizeRepositoryPath(value) {
  const path = String(value ?? '').trim().replaceAll('\\', '/');
  if (!path || path.startsWith('/') || path.includes('/../') || path === '..') {
    throw new Error(`Invalid repository path: ${value ?? ''}`);
  }
  return path.replace(/^\.\//, '');
}

function matchesPattern(path, pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === pattern;
}

export function isProductionDeploymentRelevantPath(value) {
  const path = normalizeRepositoryPath(value);
  return PRODUCTION_DEPLOYMENT_PATH_PATTERNS.some((pattern) =>
    matchesPattern(path, pattern)
  );
}

export function productionDeploymentRelevantPaths(values) {
  return [...new Set(values.map(normalizeRepositoryPath))]
    .filter(isProductionDeploymentRelevantPath)
    .sort();
}
