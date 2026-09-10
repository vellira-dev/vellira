import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});

export default {
  ...cloudflareConfig,
  buildCommand: 'node scripts/cloudflare-build.mjs',
};
