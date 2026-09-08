import { createRequire } from 'node:module';
import path from 'node:path';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

const dirname = import.meta.dirname;

const require = createRequire(import.meta.url);
const webSrc = path.resolve(dirname, '../../packages/react/src');

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@vellira-ui/icons/lottie',
        replacement: path.resolve(
          dirname,
          '../../packages/icons/src/lottie.ts'
        ),
      },
      {
        find: '@vellira-ui/icons',
        replacement: path.resolve(dirname, '../../packages/icons/src/web.ts'),
      },
      {
        find: '@vellira-ui/core',
        replacement: path.resolve(dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: 'storybook/test',
        replacement: require.resolve('storybook/test'),
      },
      { find: '@components', replacement: path.resolve(webSrc, 'components') },
      { find: '@patterns', replacement: path.resolve(webSrc, 'patterns') },
      { find: '@primitives', replacement: path.resolve(webSrc, 'primitives') },
      { find: '@styles', replacement: path.resolve(webSrc, 'styles') },
      { find: '@utils', replacement: path.resolve(webSrc, 'utils') },
      { find: '@assets', replacement: path.resolve(webSrc, 'assets') },
      { find: '@', replacement: webSrc },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@styles/mixins" as *;',
      },
    },
  },
  optimizeDeps: {
    include: [
      '@floating-ui/react',
      'clsx',
      'focus-trap-react',
      'storybook/test',
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          react(),
          svgr(),
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
