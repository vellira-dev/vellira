import assert from 'node:assert/strict';
import { unstable_readConfig as readConfig } from 'wrangler';

const archives = {
  'vellira-website-staging': 'vellira-website-staging-static-archive',
  'vellira-website': 'vellira-website-static-archive',
};

export function validateDeploymentTarget(config) {
  assert.ok(
    Object.hasOwn(archives, config.name),
    'Unrecognized deployment target'
  );
  assert.ok(
    !config.routes?.length && !config.route,
    'Public domain cutover is outside this deployment contract'
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
