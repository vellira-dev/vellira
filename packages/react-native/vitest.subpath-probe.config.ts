import { configDefaults, defineConfig } from 'vitest/config';

import baseConfig from './vitest.config.ts';

// Dedicated opt-in runtime proof. Keep the base RN aliases and test setup,
// but replace (not merge) the default exclusions that omit test/probes/**.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/probes/native-subpath-context-identity.test.mjs'],
    exclude: configDefaults.exclude,
  },
});
