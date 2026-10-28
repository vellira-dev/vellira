import path from 'node:path';

import { configDefaults, defineConfig } from 'vitest/config';

const dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(dirname, 'test/react-native.mock.tsx'),

      '@test-utils': path.resolve(dirname, 'src/test-utils'),

      '@vellira-ui/react-native': path.resolve(dirname, 'src/index.ts'),

      '@vellira-ui/core': path.resolve(dirname, '../core/src/index.ts'),

      '@vellira-ui/icons/native': path.resolve(
        dirname,
        '../icons/src/native.ts'
      ),
      '@vellira-ui/icons/lottie': path.resolve(
        dirname,
        '../icons/src/lottie.ts'
      ),
      '@vellira-ui/icons/web': path.resolve(dirname, '../icons/src/web.ts'),
      '@vellira-ui/icons': path.resolve(dirname, '../icons/src/native.ts'),

      '@vellira-ui/tokens': path.resolve(dirname, '../tokens/src/index.ts'),

      '@vellira-ui/types': path.resolve(dirname, '../types/src/index.ts'),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'test/probes/**'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        '**/dist/**',
        '**/*.styles.ts',
        '**/*.stories.*',
        '**/*.test.*',
        '**/hooks/**',
        '**/index.ts',
        '**/types.ts',
        '**/test-utils/**',
        '**/test/**',
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
