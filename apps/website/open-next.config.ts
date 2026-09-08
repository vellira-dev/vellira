import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

const config = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});

config.cloudflare!.skewProtection = {
  enabled: true,
  maxNumberOfVersions: 10,
  maxVersionAgeDays: 7,
};

export default config;
