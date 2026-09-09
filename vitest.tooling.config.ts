import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@vellira-ui/metadata': fileURLToPath(
        new URL('./packages/metadata/src/index.ts', import.meta.url)
      ),
      '@': fileURLToPath(new URL('./apps/website/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'scripts/**/*.test.tsx'],
    exclude: ['scripts/**/*.e2e.test.ts', 'node_modules/**'],
  },
});
