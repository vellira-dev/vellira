import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Keep React Native Web and React DOM on the same React instance.
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^react-native$/,
        replacement: 'react-native-web',
      },
      {
        find: '@vellira-ui/metadata',
        replacement: fileURLToPath(
          new URL('./packages/metadata/src/index.ts', import.meta.url)
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(
          new URL('./apps/website/src', import.meta.url)
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'scripts/**/*.test.tsx'],
    exclude: ['scripts/**/*.e2e.test.ts', 'node_modules/**'],
  },
});
