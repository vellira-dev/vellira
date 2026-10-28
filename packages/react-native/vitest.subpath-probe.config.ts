import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

// Dedicated opt-in runtime proof. Not part of the default unit/coverage suite.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/probes/native-subpath-context-identity.test.tsx'],
      exclude: configDefaults.exclude,
    },
  })
);
