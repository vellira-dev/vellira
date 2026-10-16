import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { experimental_readRawConfig } from 'wrangler';

const TARGET = path.resolve(import.meta.dirname, '..', 'wrangler.jsonc');

export function validateStagingGuardConfig(config) {
  assert.equal(config?.name, 'vellira-website-staging');
  assert.equal(config?.vars?.NEWSLETTER_ABUSE_GUARD_ENABLED, '0');
  const entries = config?.ratelimits;
  assert.ok(Array.isArray(entries));
  assert.deepEqual(
    entries.map(({ name, namespace_id, simple }) => ({
      name,
      namespace_id,
      limit: simple?.limit,
      period: simple?.period,
    })),
    [
      {
        name: 'NEWSLETTER_ROUTE_RATE_LIMIT',
        namespace_id: '1712202601',
        limit: 12,
        period: 60,
      },
      {
        name: 'NEWSLETTER_ACTOR_RATE_LIMIT',
        namespace_id: '1712202602',
        limit: 4,
        period: 60,
      },
    ]
  );
}

/**
 * Only an approved staging workflow_dispatch on main may write a temporary
 * ON overlay to the runner's Wrangler config. Never change source or prod.
 */
export async function prepareNewsletterGuardStagingMode({
  mode,
  githubEventName,
  githubRef,
  configPath = TARGET,
  loadConfig = (file) => experimental_readRawConfig({ config: file }).rawConfig,
  writeFile = fs.writeFile,
}) {
  assert.ok(mode === '0' || mode === '1', 'Expected staging guard mode 0 or 1');
  const config = loadConfig(configPath);
  validateStagingGuardConfig(config);
  if (mode === '0') return 'off';
  assert.equal(githubEventName, 'workflow_dispatch');
  assert.equal(githubRef, 'refs/heads/main');

  const nextConfig = structuredClone(config);
  nextConfig.vars.NEWSLETTER_ABUSE_GUARD_ENABLED = '1';
  await writeFile(configPath, JSON.stringify(nextConfig, null, 2) + '\n', {
    mode: 0o600,
  });
  return 'owner-preview';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await prepareNewsletterGuardStagingMode({
    mode: process.env.NEWSLETTER_ABUSE_GUARD_PREVIEW,
    githubEventName: process.env.GITHUB_EVENT_NAME,
    githubRef: process.env.GITHUB_REF,
  });
  console.log('Staging newsletter burst guard mode: ' + result);
}
