import assert from 'node:assert/strict';
import { unstable_readConfig as readConfig } from 'wrangler';

const archives = {
  'vellira-website-staging': 'vellira-website-staging-static-archive',
  'vellira-website': 'vellira-website-static-archive',
};

const productionCustomDomains = [
  { pattern: 'vellira.dev', custom_domain: true },
  { pattern: 'www.vellira.dev', custom_domain: true },
];

function normalizedRoutes(config) {
  const routes = config.routes ?? (config.route ? [config.route] : []);
  assert.ok(Array.isArray(routes), 'Deployment routes must be an array');
  return routes;
}

function validateRoutes(config) {
  const routes = normalizedRoutes(config);
  if (config.name === 'vellira-website-staging') {
    assert.equal(
      routes.length,
      0,
      'Staging must remain isolated from public custom domains'
    );
    return;
  }

  assert.equal(
    routes.length,
    productionCustomDomains.length,
    'Production must own exactly the canonical public custom domains'
  );
  const actual = routes
    .map((route) => {
      assert.equal(
        typeof route,
        'object',
        'Production routes must use custom-domain objects'
      );
      assert.equal(
        route.custom_domain,
        true,
        `Production route ${route.pattern ?? '<missing>'} must be a custom domain`
      );
      return { pattern: route.pattern, custom_domain: route.custom_domain };
    })
    .sort((a, b) => a.pattern.localeCompare(b.pattern));
  const expected = [...productionCustomDomains].sort((a, b) =>
    a.pattern.localeCompare(b.pattern)
  );
  assert.deepEqual(
    actual,
    expected,
    'Production custom domains must be exactly vellira.dev and www.vellira.dev'
  );
}

export function validateDeploymentTarget(config) {
  assert.ok(
    Object.hasOwn(archives, config.name),
    'Unrecognized deployment target'
  );
  validateRoutes(config);
  const bindings = config.r2_buckets?.filter(
    (binding) => binding.binding === 'STATIC_ASSET_ARCHIVE'
  );
  assert.equal(
    bindings?.length,
    1,
    'Exactly one immutable archive binding is required'
  );
  assert.equal(
    bindings[0].bucket_name,
    archives[config.name],
    'Archive bucket must belong to the target Worker'
  );
  assert.deepEqual(
    config.assets?.run_worker_first,
    ['/api/*', '/__vellira_runtime'],
    'Asset misses must reach the Worker without bypassing API handling'
  );
  assert.equal(config.assets?.html_handling, 'none');
  assert.equal(config.assets?.not_found_handling, 'none');
  return config;
}

export function readDeploymentConfig(configPath) {
  // Wrangler's JSONC parser and installed export are exercised by contract tests.
  return validateDeploymentTarget(readConfig({ config: configPath }));
}
