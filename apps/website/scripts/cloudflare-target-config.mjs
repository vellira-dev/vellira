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

const stagingOwnerBinding = {
  name: 'NEWSLETTER_GLOBAL_BUDGET',
  class_name: 'NewsletterRollingBudgetCoordinator',
  script_name: 'vellira-newsletter-budget-owner',
};

function validateGlobalBudgetBoundary(config) {
  const bindings = config.durable_objects?.bindings;
  if (config.name === 'vellira-website-staging') {
    assert.equal(
      config.vars?.NEWSLETTER_GLOBAL_BUDGET_ENABLED,
      '0',
      'Staging shared Buttondown admission must be explicitly OFF'
    );
    assert.ok(Array.isArray(bindings), 'Staging must have one external DO binding');
    assert.equal(bindings.length, 1, 'Staging must have exactly one budget DO');
    const binding = bindings[0];
    assert.deepEqual(
      {
        name: binding.name,
        class_name: binding.class_name,
        script_name: binding.script_name,
      },
      stagingOwnerBinding,
      'Staging must reference the existing private owner/class'
    );
    assert.equal(binding.environment, undefined, 'No isolated DO environment');
    assert.notEqual(binding.remote, true, 'No remote dev-only DO binding');
  } else {
    assert.equal(
      config.vars?.NEWSLETTER_GLOBAL_BUDGET_ENABLED,
      undefined,
      'Production global budget must stay absent'
    );
    assert.equal(bindings?.length ?? 0, 0, 'Production DO bindings must stay absent');
  }
  assert.equal(Object.keys(config.exports ?? {}).length, 0, 'Website must not own DO classes');
  assert.equal(config.migrations?.length ?? 0, 0, 'Website must not create DO namespaces');
}

export function validateDeploymentTarget(config) {
  assert.ok(
    Object.hasOwn(archives, config.name),
    'Unrecognized deployment target'
  );
  validateRoutes(config);
  validateGlobalBudgetBoundary(config);
  // Stable workers.dev origins are required by staging/prod deploy and recovery.
  // Version/aliased Preview URLs are not an authorized public entry point.
  assert.equal(
    config.workers_dev,
    true,
    'Canonical workers.dev diagnostic origins must remain enabled'
  );
  assert.equal(
    config.preview_urls,
    false,
    'Preview/Version URLs must be explicitly disabled on website Workers'
  );
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
